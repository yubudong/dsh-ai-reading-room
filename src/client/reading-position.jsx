import { useRef, useEffect } from "react";
import { ownedSelectionRange } from "./reader-selection.jsx";
import { canonicalOffset } from "../shared/selection-anchors.js";
import { rpc, request, API } from "./api.js";
import {
  textLocation,
  resolveTextLocation,
  pdfLocation,
  locationScroll,
} from "../shared/reading-position.js";
export function rangeForOffset(root, start, end = start + 1) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let at = 0,
    node,
    from,
    to;
  while ((node = walk.nextNode())) {
    const next = at + node.textContent.length;
    if (!from && start >= at && start < next) from = [node, start - at];
    if (end > at && end <= next) {
      to = [node, end - at];
      break;
    }
    at = next;
  }
  if (!from) return null;
  const range = document.createRange();
  range.setStart(...from);
  range.setEnd(
    ...(to || [from[0], Math.min(from[0].textContent.length, from[1] + 1)]),
  );
  return range;
}
function visibleTextOffset(root, body) {
  const box = body.getBoundingClientRect(),
    proseBox = root.getBoundingClientRect(),
    x = Math.max(proseBox.left + 5, box.left + 5),
    y = Math.max(box.top + 12, proseBox.top + 2);
  let range = document.caretRangeFromPoint?.(x, y);
  if (!range && document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) {
      range = document.createRange();
      range.setStart(p.offsetNode, p.offset);
      range.collapse();
    }
  }
  if (
    range &&
    root.contains(range.startContainer) &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    return {
      offset: before.toString().length,
      delta: range.getBoundingClientRect().top - box.top,
    };
  }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node,
    at = 0;
  while ((node = walk.nextNode())) {
    const r = document.createRange();
    r.selectNodeContents(node);
    const rect = r.getBoundingClientRect();
    if (
      node.textContent.trim() &&
      rect.bottom > box.top + 8 &&
      rect.top < box.bottom
    ) {
      let lo = 0,
        hi = Math.max(0, node.textContent.length - 1);
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        r.setStart(node, mid);
        r.setEnd(node, Math.min(node.textContent.length, mid + 1));
        if (r.getBoundingClientRect().bottom > box.top + 8) hi = mid;
        else lo = mid + 1;
      }
      r.setStart(node, lo);
      r.setEnd(node, Math.min(node.textContent.length, lo + 1));
      return {
        offset: at + lo,
        delta: r.getBoundingClientRect().top - box.top,
      };
    }
    at += node.textContent.length;
  }
  return { offset: 0, delta: 0 };
}
export function useReadingPosition({
  book,
  chapter,
  body,
  prose,
  pdf,
  onError,
  activeSelection = false,
}) {
  const pdfRenders = useRef(0),
    selectionLocks = useRef(0);
  const latest = useRef(null),
    cache = useRef(new Map()),
    restoring = useRef(false),
    raf = useRef(0),
    lastSaved = useRef(""),
    flashTimer = useRef(null),
    lastFailure = useRef(0),
    saveTimer = useRef(null);
  latest.current = {
    book,
    chapter,
    body,
    prose,
    pdf,
    onError,
    activeSelection,
  };
  function isSelecting() {
    return (
      selectionLocks.current > 0 ||
      latest.current.activeSelection ||
      !!ownedSelectionRange(
        latest.current.prose.current || latest.current.body.current,
      )
    );
  }
  function holdSelection() {
    selectionLocks.current++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        selectionLocks.current = Math.max(0, selectionLocks.current - 1);
      }
    };
  }
  function remember(forLayout = false) {
    const { chapter: c, body: b, prose: p, pdf } = latest.current,
      el = b.current;
    if (
      !c ||
      !el ||
      !el.clientHeight ||
      restoring.current ||
      pdfRenders.current > 0 ||
      isSelecting()
    )
      return cache.current.get(c?.id) || null;
    if (forLayout && cache.current.has(c.id)) return cache.current.get(c.id);
    let location;
    if (pdf)
      location = pdfLocation(
        c.id,
        el.scrollTop,
        el.scrollHeight,
        el.clientHeight,
        el.scrollLeft,
        el.scrollWidth,
        el.clientWidth,
      );
    else if (p.current) {
      const found = visibleTextOffset(p.current, el);
      const offset = canonicalOffset(
        p.current.textContent,
        c.text,
        found.offset,
      );
      if (offset === null) return cache.current.get(c.id) || null;
      location = textLocation(c.id, c.text, offset, found.delta);
    }
    if (location)
      cache.current.set(c.id, {
        chapterId: c.id,
        offset: el.scrollTop,
        location,
      });
    return cache.current.get(c.id) || null;
  }
  function fallback(id) {
    const p = latest.current.book.progress;
    return (
      cache.current.get(id) || {
        chapterId: id,
        offset: p.chapterId === id ? p.offset : 0,
        location: p.chapterId === id ? p.location : null,
      }
    );
  }
  async function save(id, offset) {
    const c = latest.current.chapter;
    let snap = c?.id === id ? remember() : null;
    snap = snap || fallback(id);
    if (Number.isFinite(offset) && !snap.location) snap = { ...snap, offset };
    const sig = JSON.stringify(snap);
    if (lastSaved.current === sig) return;
    try {
      await rpc({
        action: "progress",
        id: latest.current.book.id,
        chapterId: id,
        offset: snap.offset,
        item: { location: snap.location || undefined },
        requestId: request(),
      });
    } catch (e) {
      lastFailure.current = Date.now();
      e.retry = () => save(id, offset);
      throw e;
    }
    lastSaved.current = sig;
  }
  function restore(snapshot) {
    const { chapter: c, body: b, prose: p, pdf } = latest.current,
      el = b.current;
    if (!c || !el || !el.clientHeight || isSelecting()) return;
    const snap = snapshot || fallback(c.id),
      loc = snap.location;
    restoring.current = true;
    if (pdf) {
      el.scrollTop =
        loc?.mode === "pdf"
          ? locationScroll(loc, el.scrollHeight, el.clientHeight)
          : snap.offset || 0;
      if (loc?.mode === "pdf")
        el.scrollLeft =
          loc.xFraction * Math.max(0, el.scrollWidth - el.clientWidth);
    } else if (p.current && loc?.mode === "text") {
      const at = resolveTextLocation(c.text, loc),
        r = at === null ? null : rangeForOffset(p.current, at);
      if (r)
        el.scrollTop +=
          r.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          loc.delta;
      else el.scrollTop = snap.offset || 0;
    } else el.scrollTop = snap.offset || 0;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      restoring.current = false;
      if (loc && loc.mode === (pdf ? "pdf" : "text"))
        cache.current.set(c.id, {
          chapterId: c.id,
          offset: el.scrollTop,
          location: loc,
        });
      else remember();
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () =>
          Date.now() - lastFailure.current > 10000
            ? save(c.id).catch((e) => latest.current.onError?.(e))
            : null,
        400,
      );
    });
  }
  function flash(anchor) {
    const root = latest.current.prose.current;
    if (!root) return;
    const r = rangeForOffset(
      root,
      Math.min(
        anchor.start,
        Math.max(0, latest.current.chapter.text.length - 1),
      ),
      Math.min(
        anchor.end || anchor.start + 1,
        latest.current.chapter.text.length,
      ),
    );
    if (!r) return;
    const el = latest.current.body.current;
    restoring.current = true;
    el.scrollTop +=
      r.getBoundingClientRect().top -
      el.getBoundingClientRect().top -
      el.clientHeight * 0.25;
    if (globalThis.CSS?.highlights && globalThis.Highlight) {
      CSS.highlights.set("arr-reading-jump", new Highlight(r));
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(
        () => CSS.highlights.delete("arr-reading-jump"),
        2200,
      );
    }
    raf.current = requestAnimationFrame(() => {
      restoring.current = false;
      remember();
    });
  }
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    let lastW = el.clientWidth,
      lastH = el.clientHeight;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) {
        lastW = lastH = 0;
        return;
      }
      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        restore();
      }
    });
    observer.observe(el);
    function flush() {
      const c = latest.current.chapter,
        snap = c ? cache.current.get(c.id) : null;
      if (!snap || lastSaved.current === JSON.stringify(snap)) return;
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          id: latest.current.book.id,
          chapterId: snap.chapterId,
          offset: snap.offset,
          item: { location: snap.location },
          requestId: request(),
        }),
        keepalive: true,
      }).catch(() => {});
    }
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      clearTimeout(saveTimer.current);
      observer.disconnect();
      cancelAnimationFrame(raf.current);
      clearTimeout(flashTimer.current);
      globalThis.CSS?.highlights?.delete("arr-reading-jump");
    };
  }, []);
  function hold() {
    pdfRenders.current++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        pdfRenders.current = Math.max(0, pdfRenders.current - 1);
      }
    };
  }
  return {
    holdSelection,
    isSelecting,
    hold,
    remember,
    save,
    restore,
    flash,
    current: (id) => fallback(id),
    isRestoring: () => restoring.current || pdfRenders.current > 0,
  };
}
