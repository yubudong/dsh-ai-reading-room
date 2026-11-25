import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import { rpc, API, request, download } from "./api.js";
import { RecordCard } from "./forms.jsx";
import { SpiritPanel } from "./spirit.jsx";
import { SpiritAvatar } from "./spirit-avatar.jsx";
import { useReadingDock, DockResizer } from "./reading-dock.jsx";
import { useReadingKeys } from "./reading-keys.js";
import { useReadingPosition, rangeForOffset } from "./reading-position.jsx";
import {
  useReaderSelection,
  readSelectionAnchor,
  ownedSelectionRange,
  domRangeOffsets,
} from "./reader-selection.jsx";
import { annotationPaintKey } from "../shared/selection-anchors.js";
import { AnnotationMenu } from "./annotation-menu.jsx";
import { renderAnnotations } from "./annotation-dom.js";
import {
  annotationAppearance,
  exactAnnotation,
  pdfAnnotationAt,
  ANNOTATION_PALETTE,
} from "../shared/annotations.js";
pdfjs.GlobalWorkerOptions.workerSrc = API + "/pdf.worker.mjs";
// Sanitize again at the rendering boundary, including imported portable backups.
function safeHtml(html) {
  // Parse the chapter as a fragment: document parsing discards leading whitespace.
  const d = new DOMParser().parseFromString("", "text/html"),
    fragment = d.createElement("div");
  fragment.innerHTML = html;
  const tags = new Set([
    "P",
    "DIV",
    "SPAN",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "BLOCKQUOTE",
    "UL",
    "OL",
    "LI",
    "STRONG",
    "EM",
    "B",
    "I",
    "U",
    "S",
    "PRE",
    "CODE",
    "BR",
    "HR",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "SUP",
    "SUB",
    "A",
    "IMG",
    "FIGURE",
    "FIGCAPTION",
    "DL",
    "DT",
    "DD",
  ]);
  for (const e of [...fragment.querySelectorAll("*")]) {
    if (!tags.has(e.tagName)) {
      e.remove();
      continue;
    }
    for (const a of [...e.attributes]) {
      if (
        a.name === "id" ||
        a.name === "alt" ||
        a.name === "title" ||
        ["colspan", "rowspan"].includes(a.name)
      )
        continue;
      if (
        e.tagName === "IMG" &&
        a.name === "src" &&
        /^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(a.value)
      )
        continue;
      if (e.tagName === "A" && a.name === "href" && a.value.startsWith("#"))
        continue;
      e.removeAttribute(a.name);
    }
  }
  return fragment.innerHTML;
}
function offsetAt(root, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}
function rangeAt(root, start, end) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let at = 0,
    node,
    from = null,
    to = null;
  while ((node = walker.nextNode())) {
    const next = at + node.textContent.length;
    if (from === null && start >= at && start < next) from = [node, start - at];
    if (end > at && end <= next) {
      to = [node, end - at];
      break;
    }
    at = next;
  }
  if (!from || !to) return null;
  const r = document.createRange();
  r.setStart(...from);
  r.setEnd(...to);
  return r;
}
export function Reader({
  info,
  chrome,
  notices,
  setInfo,
  settings,
  t,
  lang,
  date,
  run,
  showNote,
  busy,
  back,
  setModal,
  preferences = {},
  onNavigate,
}) {
  const b = info.book;
  const [chapterId, setChapterId] = useState(b.progress.chapterId || "c0"),
    [chapter, setChapter] = useState(null),
    [side, setSide] = useState("spirit"),
    [toc, setToc] = useState(true),
    [selection, setSelection] = useState(null),
    [annotationMenu, setAnnotationMenu] = useState(null),
    [annotationHistory, setAnnotationHistory] = useState({
      canUndo: false,
      canRedo: false,
    }),
    [chatSeed, setChatSeed] = useState(""),
    [jump, setJump] = useState(null),
    [pdfMode, setPdfMode] = useState(true),
    [zoom, updateZoom] = useState(1),
    [focusSignal, setFocusSignal] = useState(0),
    [fontSize, updateFontSize] = useState(settings.fontSize),
    [focusMode, updateFocusMode] = useState(() => {
      try {
        return localStorage.getItem("arr-reader-focus") === "true";
      } catch {
        return false;
      }
    }),
    [returns, setReturns] = useState([]),
    [discussionId, setDiscussionId] = useState(""),
    [discussionModel, setDiscussionModel] = useState(null),
    [sessionSince] = useState(() => new Date().toISOString());
  const positionApi = useRef(null);
  const dock = useReadingDock(toc, () => positionApi.current?.remember(true));
  function setFontSize(value) {
    positionApi.current?.remember(true);
    updateFontSize(value);
  }
  function setZoom(value) {
    positionApi.current?.remember(true);
    updateZoom(value);
  }
  function toggleFocus() {
    positionApi.current?.remember(true);
    updateFocusMode((value) => {
      try {
        localStorage.setItem("arr-reader-focus", String(!value));
      } catch {}
      return !value;
    });
  }
  function openReview() {
    setModal({
      kind: "readingReview",
      bookId: b.id,
      chapterId,
      discussionId: discussionId || info.exercises?.[0]?.id || "",
      since: sessionSince,
      location: positionApi.current?.remember(true)?.location || null,
      model: discussionModel,
      onUpdate: update,
    });
  }
  function openSpirit() {
    dock.setOpen(true);
    setSide("spirit");
    setFocusSignal((x) => x + 1);
  }
  const body = useRef(null),
    prose = useRef(null),
    timer = useRef(null),
    chapterRef = useRef(chapterId),
    infoRef = useRef(info),
    seq = useRef(0),
    renderedChapter = useRef(null),
    appliedJump = useRef(null);
  const position = useReadingPosition({
    book: b,
    chapter,
    body,
    prose,
    pdf: b.format === "pdf" && pdfMode,
    onError: (e) => run(() => Promise.reject(e)),
    activeSelection: !!annotationMenu,
  });
  positionApi.current = position;
  infoRef.current = info;
  chapterRef.current = chapterId;
  useEffect(() => {
    let alive = true;
    setChapter(null);
    setSelection(null);
    setAnnotationMenu(null);
    rpc({ action: "chapter", id: b.id, chapterId })
      .then((v) => {
        if (alive) setChapter(v.chapter);
      })
      .catch((e) => run(() => Promise.reject(e)));
    return () => {
      alive = false;
    };
  }, [chapterId]);
  useEffect(() => {
    try {
      const x = JSON.parse(
        sessionStorage.getItem("arr-jump:" + b.id) || "null",
      );
      if (x) {
        sessionStorage.removeItem("arr-jump:" + b.id);
        go(x);
      }
    } catch {}
    return () => {
      clearTimeout(timer.current);
    };
  }, []);
  const saveProgress = (id, offset) => position.save(id, offset);
  function scheduleProgress() {
    clearTimeout(timer.current);
    if (position.isRestoring()) return;
    position.remember();
    const id = chapterRef.current,
      offset = body.current?.scrollTop || 0;
    timer.current = setTimeout(
      () => saveProgress(id, offset).catch((e) => run(() => Promise.reject(e))),
      600,
    );
  }
  function changeChapter(id) {
    clearTimeout(timer.current);
    const old = chapterRef.current;
    if (body.current) saveProgress(old, body.current.scrollTop).catch(() => {});
    setChapterId(id);
  }
  function go(anchor, remember = true) {
    const origin = position.remember() || position.current(chapterId);
    if (remember) setReturns((old) => [...old, origin].slice(-10));
    setSelection(null);
    setAnnotationMenu(null);
    window.getSelection()?.removeAllRanges();
    setJump({ ...anchor, key: ++seq.current });
    setChapterId(anchor.chapterId);
  }
  const paintKey = useMemo(
    () => annotationPaintKey(info.records, chapterId),
    [info.records, chapterId],
  );
  useEffect(() => {
    if (!chapter || !prose.current || (b.format === "pdf" && pdfMode)) return;
    const sameChapter = renderedChapter.current === chapter.id,
      offset = body.current?.scrollTop || 0;
    const root = prose.current,
      selected = ownedSelectionRange(root),
      saved = selected ? domRangeOffsets(root, selected) : null;
    root.innerHTML = safeHtml(chapter.html);
    renderAnnotations(root, infoRef.current.records, chapter.id, chapter.text);
    if (saved) {
      const range = rangeAt(root, saved.start, saved.end);
      if (range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else if (sameChapter && body.current) {
      body.current.scrollTop = offset;
      position.remember();
    } else position.restore();
    renderedChapter.current = chapter.id;
  }, [chapter, paintKey, pdfMode]);
  useLayoutEffect(() => {
    if (chapter && prose.current && !(b.format === "pdf" && pdfMode))
      position.restore();
  }, [fontSize, settings.lineHeight, settings.pageWidth, pdfMode]);
  useEffect(() => {
    if (
      !chapter ||
      !prose.current ||
      (b.format === "pdf" && pdfMode) ||
      !jump ||
      jump.chapterId !== chapter.id ||
      appliedJump.current === jump.key
    )
      return;
    if (jump.location || jump.restorePosition)
      position.restore({ location: jump.location, offset: jump.offset || 0 });
    else position.flash(jump);
    appliedJump.current = jump.key;
  }, [chapter, jump, pdfMode]);
  function currentAnchor() {
    return readSelectionAnchor(prose.current, chapter);
  }
  useReaderSelection({
    root: prose,
    chapter,
    enabled: !!chapter && !(b.format === "pdf" && pdfMode),
    onSelection: trackSelection,
    menu: annotationMenu,
    holdSelection: position.holdSelection,
  });
  function trackSelection(anchor) {
    setSelection((old) =>
      old &&
      old.chapterId === anchor.chapterId &&
      old.start === anchor.start &&
      old.end === anchor.end &&
      old.quote === anchor.quote
        ? old
        : anchor,
    );
  }
  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    rpc(
      { action: "annotationState", bookId: b.id, item: { summaryOnly: true } },
      ac.signal,
    )
      .then((x) => {
        if (active) setAnnotationHistory(x.history);
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") run(() => Promise.reject(e));
      });
    return () => {
      active = false;
      ac.abort();
    };
  }, [b.id, info.records]);
  function showAnnotation(
    anchor,
    { clientX, clientY, mode = null, recordId } = {},
  ) {
    if (!anchor || mode !== "context") return;
    const bounds = dock.containerRef.current.getBoundingClientRect();
    setSelection(anchor);
    setAnnotationMenu({
      key: ++seq.current,
      anchor,
      recordId:
        recordId || exactAnnotation(infoRef.current.records, anchor)?.id || "",
      mode,
      x: (clientX ?? bounds.left + 30) - bounds.left,
      y: (clientY ?? bounds.top + 60) - bounds.top,
    });
  }
  function capture(e) {
    if (e?.button === 2) return;
    const a = currentAnchor();
    if (a)
      showAnnotation(a.anchor, {
        clientX: a.rect.left,
        clientY: a.rect.bottom + 8,
      });
  }
  function contextAnnotation(e) {
    if (!prose.current?.contains(e.target)) return;
    const mark = e.target.closest("[data-record-id]"),
      r =
        mark &&
        infoRef.current.records.find(
          (r) => r.id === mark.dataset.recordId && !r.deletedAt,
        );
    const native = currentAnchor(),
      range = window.getSelection()?.rangeCount
        ? window.getSelection().getRangeAt(0)
        : null,
      inside =
        native &&
        range &&
        [...range.getClientRects()].some(
          (a) =>
            e.clientX >= a.left &&
            e.clientX <= a.right &&
            e.clientY >= a.top &&
            e.clientY <= a.bottom,
        );
    const anchor = inside ? native.anchor : r?.anchor;
    if (anchor) {
      e.preventDefault();
      showAnnotation(anchor, {
        clientX: e.clientX,
        clientY: e.clientY,
        mode: "context",
        recordId: inside
          ? exactAnnotation(infoRef.current.records, anchor)?.id
          : r?.id,
      });
    }
  }
  function closeAnnotation(clear = false) {
    setAnnotationMenu(null);
    if (clear) {
      setSelection(null);
      window.getSelection()?.removeAllRanges();
      body.current?.focus({ preventScroll: true });
    }
  }
  async function refreshAnnotations() {
    const result = await rpc({ action: "annotationState", bookId: b.id });
    setAnnotationHistory(result.history);
    setInfo((old) =>
      old?.book.id === b.id ? { ...old, records: result.items } : old,
    );
  }
  async function styleAnnotation(appearance) {
    const menu = annotationMenu;
    if (!menu || busy) return;
    const r = infoRef.current.records.find(
        (r) => r.id === menu.recordId && !r.deletedAt,
      ),
      requestId = request();
    await run(async () => {
      const result = await rpc({
        action: "annotationAction",
        bookId: b.id,
        id: r?.id,
        revision: r?.revision,
        item: {
          operation: "style",
          anchor: r ? undefined : menu.anchor,
          annotation: appearance,
        },
        requestId,
      });
      setAnnotationHistory(result.history);
      try {
        localStorage.setItem("arr-last-annotation", JSON.stringify(appearance));
      } catch {}
      closeAnnotation(true);
      await refreshAnnotations();
    });
  }
  function noteAnnotation() {
    const menu = annotationMenu;
    if (!menu) return;
    const record = infoRef.current.records.find(
      (r) => r.id === menu.recordId && !r.deletedAt,
    );
    setModal({
      kind: "note",
      bookId: b.id,
      record,
      type: record?.kind || "note",
      body: record?.body || "",
      anchor: menu.anchor,
      annotation: record
        ? annotationAppearance(record)
        : { style: "highlight", color: "yellow" },
      origin: record?.origin || "user",
    });
    closeAnnotation();
  }
  async function removeAnnotation() {
    const r = infoRef.current.records.find(
      (r) => r.id === annotationMenu?.recordId && !r.deletedAt,
    );
    if (!r || busy) return;
    const requestId = request();
    await run(async () => {
      const result = await rpc({
        action: "annotationAction",
        bookId: b.id,
        id: r.id,
        revision: r.revision,
        item: { operation: "remove" },
        requestId,
      });
      setAnnotationHistory(result.history);
      closeAnnotation(true);
      await refreshAnnotations();
    });
  }
  async function replayAnnotation(direction) {
    if (
      busy ||
      !(direction === "undo"
        ? annotationHistory.canUndo
        : annotationHistory.canRedo)
    )
      return;
    const requestId = request();
    await run(async () => {
      const result = await rpc({
        action: "annotationReplay",
        bookId: b.id,
        item: {
          direction,
          expectedId:
            direction === "undo"
              ? annotationHistory.undoId
              : annotationHistory.redoId,
        },
        requestId,
      });
      setAnnotationHistory(result.history);
      closeAnnotation(true);
      await refreshAnnotations();
    });
  }
  async function update() {
    setInfo(await rpc({ action: "open", id: b.id }));
  }
  const allRecords = info.records.filter((r) => !r.deletedAt),
    chapterIndex = info.chapters.findIndex((c) => c.id === chapterId);
  function pageStep(direction) {
    const el = body.current;
    if (!el) return;
    const edge =
      direction > 0
        ? el.scrollTop + el.clientHeight >= el.scrollHeight - 3
        : el.scrollTop <= 2;
    if (edge) {
      const next = chapterIndex + direction;
      if (info.chapters[next]) changeChapter(info.chapters[next].id);
    } else
      el.scrollBy({
        top: direction * el.clientHeight * 0.88,
        behavior: "auto",
      });
  }
  function returnReading() {
    const last = returns.at(-1);
    if (!last) return;
    setReturns((old) => old.slice(0, -1));
    go({ ...last, chapterId: last.chapterId, restorePosition: true }, false);
  }
  const historyKeys = useReadingKeys({
    undoAnnotation: () => replayAnnotation("undo"),
    redoAnnotation: () => replayAnnotation("redo"),
  });
  const keys = useReadingKeys({
    undoAnnotation: () => replayAnnotation("undo"),
    redoAnnotation: () => replayAnnotation("redo"),
    focus: toggleFocus,
    returnReading,
    down: () => body.current?.scrollBy({ top: 50 }),
    up: () => body.current?.scrollBy({ top: -50 }),
    forward: (e) => {
      if (b.format === "pdf" && zoom > 1 && e.code === "ArrowRight")
        body.current?.scrollBy({ left: 80 });
      else pageStep(1);
    },
    backward: (e) => {
      if (b.format === "pdf" && zoom > 1 && e.code === "ArrowLeft")
        body.current?.scrollBy({ left: -80 });
      else pageStep(-1);
    },
    start: () => body.current?.scrollTo({ top: 0 }),
    end: () => body.current?.scrollTo({ top: body.current.scrollHeight }),
    find: () => setModal({ kind: "search", bookId: b.id, onJump: go }),
    goto: () => setModal({ kind: "goto", chapters: info.chapters, onJump: go }),
    toc: () => {
      position.remember();
      setToc(!toc);
    },
    ask: openSpirit,
    note: () => showNote(b.id, "reflection", selection),
    bookmark: () =>
      showNote(
        b.id,
        "note",
        b.format === "pdf"
          ? { chapterId, start: 0, end: 0, quote: "", pageOnly: true }
          : null,
        "🔖 " + (chapter?.title || b.title),
      ),
    bigger: () =>
      b.format === "pdf"
        ? setZoom(Math.min(2, zoom + 0.1))
        : setFontSize(Math.min(32, fontSize + 1)),
    smaller: () =>
      b.format === "pdf"
        ? setZoom(Math.max(0.5, zoom - 0.1))
        : setFontSize(Math.max(14, fontSize - 1)),
    help: () => setModal({ kind: "help", topic: "keys" }),
  });
  return (
    <div
      className={
        "arr-reading-shell" +
        (dock.open ? " is-dock-open" : "") +
        (focusMode ? " is-focused" : "")
      }
      onKeyDownCapture={(e) => {
        if (e.target.closest(".arr-reading-workspace,.arr-annotation-menu"))
          historyKeys(e);
      }}
      ref={dock.containerRef}
      style={{
        "--arr-side-width": dock.width + "px",
        "--arr-toc-width": dock.tocWidth + "px",
      }}
    >
      <section
        className="arr-reading-workspace"
        hidden={dock.open && dock.expanded}
      >
        {!focusMode && chrome}
        {notices}
        <div className="readbar row spread arr-bookbar">
          <div className="row">
            <button
              onClick={() => {
                clearTimeout(timer.current);
                run(async () => {
                  await saveProgress(chapterId, body.current?.scrollTop || 0);
                  back();
                });
              }}
            >
              {t("back")}
            </button>
            <button
              aria-selected={toc}
              onClick={() => {
                position.remember();
                setToc(!toc);
              }}
            >
              {t("contents")}
            </button>
            <b className="arr-book-heading" title={b.title}>
              {b.title}
            </b>
            <span className="pill">{t(b.status)}</span>
          </div>
          <div className="row">
            {focusMode && (
              <div className="arr-focus-chapters">
                <button
                  disabled={chapterIndex <= 0}
                  onClick={() =>
                    changeChapter(info.chapters[chapterIndex - 1].id)
                  }
                >
                  ‹
                </button>
                <span>
                  {chapterIndex + 1}/{info.chapters.length}
                </span>
                <button
                  disabled={chapterIndex >= info.chapters.length - 1}
                  onClick={() =>
                    changeChapter(info.chapters[chapterIndex + 1].id)
                  }
                >
                  ›
                </button>
                {returns.length > 0 && (
                  <button onClick={returnReading}>
                    {t("returnToReading")}
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() =>
                setModal({ kind: "search", bookId: b.id, onJump: go })
              }
            >
              {t("searchText")}
            </button>
            <button onClick={() => setModal({ kind: "meta", book: b })}>
              {t("metadata")}
            </button>
            <button
              onClick={() =>
                run(async () => {
                  const v = await rpc({ action: "export", id: b.id });
                  download(v.text, v.name, "text/markdown;charset=utf-8");
                })
              }
            >
              {t("export")}
            </button>
            <div className="arr-history-buttons">
              <button
                title={t(
                  annotationHistory.blocked && !annotationHistory.canUndo
                    ? "annotationHistoryChanged"
                    : "undoAnnotation",
                )}
                aria-label={t("undoAnnotation")}
                disabled={busy || !annotationHistory.canUndo}
                onClick={() => replayAnnotation("undo")}
              >
                ↶
              </button>
              <button
                title={t("redoAnnotation")}
                aria-label={t("redoAnnotation")}
                disabled={busy || !annotationHistory.canRedo}
                onClick={() => replayAnnotation("redo")}
              >
                ↷
              </button>
            </div>
            <button
              className="arr-focus-toggle"
              aria-pressed={focusMode}
              onClick={toggleFocus}
            >
              {t(focusMode ? "exitFocus" : "focusReading")}
            </button>
            <details
              className="arr-reader-more"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  e.currentTarget.open = false;
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary")?.focus();
                  e.stopPropagation();
                }
              }}
            >
              <summary>{t("more")}</summary>
              <div>
                <button onClick={openReview}>{t("readingReview")}</button>
                <button
                  onClick={() =>
                    setModal({ kind: "search", bookId: b.id, onJump: go })
                  }
                >
                  {t("searchText")}
                </button>
                <button onClick={() => setModal({ kind: "meta", book: b })}>
                  {t("metadata")}
                </button>
                <button
                  onClick={() =>
                    run(async () => {
                      const v = await rpc({ action: "export", id: b.id });
                      download(v.text, v.name, "text/markdown;charset=utf-8");
                    })
                  }
                >
                  {t("export")}
                </button>
                <button onClick={() => onNavigate?.("traces")}>
                  {t("traces")}
                </button>
                <button onClick={() => onNavigate?.("methodLibrary")}>
                  {t("methodLibrary")}
                </button>
                <button onClick={() => onNavigate?.("settings")}>
                  {t("settings")}
                </button>
                <button onClick={() => setModal({ kind: "help" })}>
                  {t("help")}
                </button>
                <button onClick={() => setModal({ kind: "import" })}>
                  {t("import")}
                </button>
                <div className="row">
                  <button
                    onClick={() =>
                      b.format === "pdf" && pdfMode
                        ? setZoom(Math.max(0.5, zoom - 0.1))
                        : setFontSize(Math.max(14, fontSize - 1))
                    }
                  >
                    A−
                  </button>
                  <span>
                    {b.format === "pdf" && pdfMode
                      ? Math.round(zoom * 100) + "%"
                      : fontSize}
                  </span>
                  <button
                    onClick={() =>
                      b.format === "pdf" && pdfMode
                        ? setZoom(Math.min(2, zoom + 0.1))
                        : setFontSize(Math.min(32, fontSize + 1))
                    }
                  >
                    A+
                  </button>
                </div>
              </div>
            </details>
            <button
              className="arr-spirit-toggle"
              aria-expanded={dock.open}
              onClick={() => (dock.open ? dock.setOpen(false) : openSpirit())}
            >
              <SpiritAvatar size={25} />
              {t("spirit")}
            </button>
          </div>
        </div>
        <div className="reader">
          {toc && (
            <aside
              className="toc arr-toc-pane"
              hidden={dock.open && dock.expanded}
            >
              <div className="arr-toc-scroll">
                <div className="muted small">
                  {t("contents")} · {info.chapters.length}
                </div>
                {(
                  info.toc ||
                  info.chapters.map((c) => ({
                    id: c.id,
                    title: c.title,
                    chapterId: c.id,
                    depth: 0,
                    textOffset: 0,
                  }))
                ).map((c) => (
                  <button
                    key={c.id}
                    style={{ paddingLeft: 8 + (c.depth || 0) * 13 }}
                    aria-selected={c.chapterId === chapterId}
                    title={c.title}
                    onClick={() =>
                      go({
                        chapterId: c.chapterId,
                        start: c.textOffset || 0,
                        end: (c.textOffset || 0) + 1,
                      })
                    }
                  >
                    {b.format === "pdf"
                      ? t("pdfLabel") + " " + (Number(c.chapterId.slice(1)) + 1)
                      : c.title}
                  </button>
                ))}
                {info.navigationWarning && (
                  <p className="muted small">{t("navigationWarning")}</p>
                )}
              </div>
              <DockResizer
                dock={dock.tocPanel}
                label={t("resizeContents")}
                edge="right"
                defaultWidth={200}
                className="arr-toc-resizer"
              />
            </aside>
          )}
          <main className="reading" hidden={dock.open && dock.expanded}>
            <div className="readbar row spread arr-chapterbar">
              <div className="row">
                {returns.length > 0 && (
                  <button onClick={returnReading}>
                    {t("returnToReading")}
                  </button>
                )}
                <button
                  disabled={chapterIndex <= 0}
                  onClick={() =>
                    changeChapter(info.chapters[chapterIndex - 1].id)
                  }
                >
                  {t("prev")}
                </button>
                <span className="small">
                  {chapterIndex + 1} / {info.chapters.length}
                </span>
                <button
                  disabled={chapterIndex >= info.chapters.length - 1}
                  onClick={() =>
                    changeChapter(info.chapters[chapterIndex + 1].id)
                  }
                >
                  {t("next")}
                </button>
              </div>
              <div className="row">
                {b.format === "pdf" ? (
                  <>
                    <button onClick={() => setPdfMode(!pdfMode)}>
                      {t(pdfMode ? "textMode" : "pageMode")}
                    </button>
                    <button onClick={() => setZoom(Math.max(0.5, zoom - 0.15))}>
                      −
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(2, zoom + 0.15))}>
                      +
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        b.format === "pdf" && pdfMode
                          ? setZoom(Math.max(0.5, zoom - 0.1))
                          : setFontSize(Math.max(14, fontSize - 1))
                      }
                    >
                      A−
                    </button>
                    <span>
                      {b.format === "pdf" && pdfMode
                        ? Math.round(zoom * 100) + "%"
                        : fontSize}
                    </span>
                    <button
                      onClick={() =>
                        b.format === "pdf" && pdfMode
                          ? setZoom(Math.min(2, zoom + 0.1))
                          : setFontSize(Math.min(32, fontSize + 1))
                      }
                    >
                      A+
                    </button>
                  </>
                )}
              </div>
            </div>
            <div
              className="body"
              ref={body}
              tabIndex={0}
              aria-label={t("reading")}
              onKeyDown={keys}
              onScroll={() => {
                scheduleProgress();
                if (!position.isSelecting()) setAnnotationMenu(null);
              }}
            >
              {!chapter ? (
                <p>{t("loading")}</p>
              ) : b.format === "pdf" && pdfMode ? (
                <>
                  <PdfPage
                    book={b}
                    chapter={chapter}
                    pageIndex={chapter.index}
                    zoom={zoom}
                    t={t}
                    onError={(e) => run(() => Promise.reject(e))}
                    onSelect={(anchor, position) =>
                      position?.mode === "context"
                        ? showAnnotation(anchor, position)
                        : trackSelection(anchor)
                    }
                    records={allRecords}
                    jump={jump}
                    selectionMenu={annotationMenu}
                    holdSelection={position.holdSelection}
                    onRenderStart={position.hold}
                    onRendered={() => {
                      if (
                        (jump?.location || jump?.restorePosition) &&
                        jump.chapterId === chapterId &&
                        appliedJump.current !== jump.key
                      ) {
                        position.restore({
                          location: jump.location,
                          offset: jump.offset || 0,
                        });
                        appliedJump.current = jump.key;
                      } else position.restore();
                    }}
                  />
                  <div className="row" style={{ marginTop: 14 }}>
                    <button
                      onClick={() =>
                        showNote(
                          b.id,
                          "note",
                          {
                            chapterId: chapter.id,
                            start: 0,
                            end: 0,
                            quote: "",
                            pageOnly: true,
                          },
                          t("pdfLabel") + " " + (chapter.index + 1),
                        )
                      }
                    >
                      {t("bookmark")}
                    </button>
                    {b.hasText && (
                      <button onClick={() => setPdfMode(false)}>
                        {t("textMode")}
                      </button>
                    )}
                  </div>
                  {!b.hasText && <p className="muted">{t("scanned")}</p>}
                </>
              ) : (
                <article
                  ref={prose}
                  className="prose"
                  onContextMenu={contextAnnotation}
                  style={{
                    fontSize: fontSize + "px",
                    lineHeight: settings.lineHeight,
                    maxWidth: settings.pageWidth,
                  }}
                />
              )}
            </div>
            <footer className="footer">
              {chapter?.title} · {t("selectHint")}
            </footer>
          </main>
        </div>
      </section>
      <aside
        className={
          "side arr-reading-dock" + (dock.expanded ? " is-expanded" : "")
        }
        hidden={!dock.open}
        aria-label={t("spirit")}
      >
        {!dock.expanded && (
          <DockResizer dock={dock} label={t("resizeSpirit")} />
        )}
        <div className="arr-dock-inner">
          <div className="arr-dock-header">
            <div className="arr-dock-heading">
              <SpiritAvatar size={36} />
              <strong>{t("spirit")}</strong>
            </div>
            <div className="row">
              <button
                className="arr-icon-button"
                title={t(dock.expanded ? "restoreDock" : "expandDock")}
                aria-label={t(dock.expanded ? "restoreDock" : "expandDock")}
                aria-pressed={dock.expanded}
                onClick={() => dock.setExpanded(!dock.expanded)}
              >
                {dock.expanded ? "↙" : "↗"}
              </button>
              <button
                className="arr-icon-button"
                title={t("closeSpirit")}
                aria-label={t("closeSpirit")}
                onClick={() => dock.setOpen(false)}
              >
                ×
              </button>
            </div>
          </div>
          <div className="row sidetabs arr-dock-tabs">
            {["spirit", "notes", "history"].map((k) => (
              <button
                key={k}
                aria-selected={side === k}
                onClick={() => setSide(k)}
              >
                {t(k)}
                {k === "notes" ? " · " + allRecords.length : ""}
              </button>
            ))}
          </div>
          <div className="arr-chat-content" hidden={side !== "spirit"}>
            <SpiritPanel
              key={b.id}
              book={b}
              chapters={info.chapters}
              chapterId={chapterId}
              anchor={selection}
              t={t}
              lang={lang}
              date={date}
              run={run}
              onUpdate={update}
              exercises={info.exercises}
              showNote={showNote}
              onJump={go}
              focusSignal={focusSignal}
              onDiscussionChange={setDiscussionId}
              onModelChange={setDiscussionModel}
              getReadingLocation={() => position.remember()?.location}
              onReview={openReview}
              initialMessage={chatSeed}
              onMethodDialog={(data) =>
                setModal({ kind: "methodology", ...data })
              }
              onHelp={(topic) => setModal({ kind: "help", topic })}
            />
          </div>
          {side !== "spirit" && (
            <div className="sidebody">
              {side === "notes" ? (
                <>
                  <button onClick={() => showNote(b.id, "note")}>
                    {t("newNote")}
                  </button>
                  <div style={{ marginTop: 14 }}>
                    {allRecords.length ? (
                      allRecords
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                        .map((r) => (
                          <RecordCard
                            key={r.id}
                            r={r}
                            labels={preferences.annotationLabels}
                            t={t}
                            date={date}
                            onSource={go}
                            onEdit={(r) =>
                              setModal({
                                kind: "note",
                                record: r,
                                bookId: b.id,
                                type: r.kind,
                                body: r.body,
                                anchor: r.anchor,
                                origin: r.origin,
                              })
                            }
                            onTrash={(r) =>
                              run(async () => {
                                await rpc({
                                  action: "trashRecord",
                                  id: r.id,
                                  revision: r.revision,
                                  requestId: request(),
                                });
                                await update();
                              })
                            }
                          />
                        ))
                    ) : (
                      <p className="muted">{t("noNotes")}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="card">
                    <b>
                      {t("history")} · #{b.progress.pass}
                    </b>
                    <p>{date(b.createdAt)}</p>
                    <p className="muted">{t("newPassHint")}</p>
                    <button
                      onClick={() =>
                        run(async () => {
                          await rpc({
                            action: "newPass",
                            id: b.id,
                            revision: b.revision,
                            requestId: request(),
                          });
                          await update();
                          setChapterId("c0");
                        })
                      }
                    >
                      {t("newPass")}
                    </button>
                  </div>
                  {[
                    ...allRecords.map((r) => ({
                      at: r.createdAt,
                      label: t(r.kind),
                      body: r.body || r.anchor?.quote,
                      anchor: r.anchor,
                    })),
                    ...info.exercises.map((x) => ({
                      at: x.createdAt,
                      label: t(x.method),
                      body: x.title || x.goal,
                    })),
                  ]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((x, i) => (
                      <div className="card" key={i}>
                        <div className="small muted">{date(x.at)}</div>
                        <b>{x.label}</b>
                        <p>{x.body}</p>
                        {x.anchor && (
                          <button onClick={() => go(x.anchor)}>
                            {t("source")}
                          </button>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </aside>
      {annotationMenu && (
        <AnnotationMenu
          labels={preferences.annotationLabels}
          menu={annotationMenu}
          bounds={{
            width: dock.containerRef.current?.clientWidth || 900,
            height: dock.containerRef.current?.clientHeight || 700,
          }}
          record={info.records.find((r) => r.id === annotationMenu.recordId)}
          t={t}
          busy={busy}
          onStyle={styleAnnotation}
          onNote={noteAnnotation}
          onRemove={removeAnnotation}
          history={annotationHistory}
          onUndo={() => replayAnnotation("undo")}
          onRedo={() => replayAnnotation("redo")}
          onClose={closeAnnotation}
          onAsk={() => {
            closeAnnotation();
            openSpirit();
          }}
          onCopy={() =>
            run(async () => {
              await navigator.clipboard.writeText(annotationMenu.anchor.quote);
              closeAnnotation();
            })
          }
          onTranslate={() => {
            setChatSeed(
              (lang === "zh"
                ? "请翻译这段原文，并结合上下文说明：\n"
                : "Please translate and explain this passage in context:\n") +
                annotationMenu.anchor.quote,
            );
            closeAnnotation();
            openSpirit();
          }}
          onSearch={() => {
            setModal({
              kind: "search",
              bookId: b.id,
              query: annotationMenu.anchor.quote,
              onJump: go,
            });
            closeAnnotation();
          }}
        />
      )}
    </div>
  );
}
function PdfPage({
  book,
  chapter,
  pageIndex,
  zoom,
  t,
  onError,
  onSelect,
  records,
  jump,
  onRendered,
  onRenderStart,
  selectionMenu,
  holdSelection,
}) {
  const host = useRef(null),
    canvas = useRef(null),
    layer = useRef(null),
    docRef = useRef(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [size, setSize] = useState({ width: 0, height: 0 }),
    [availableWidth, setAvailableWidth] = useState(0),
    lastPdfJump = useRef(null);
  useEffect(() => {
    const el = host.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setAvailableWidth(el.clientWidth),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    const task = pdfjs.getDocument({
      url: API + "/original?id=" + encodeURIComponent(book.id),
      isEvalSupported: false,
      useSystemFonts: true,
      cMapUrl: API + "/pdf-resource?kind=cmaps&name=",
      cMapPacked: true,
      standardFontDataUrl: API + "/pdf-resource?kind=standard_fonts&name=",
      wasmUrl: API + "/pdf-resource?kind=wasm&name=",
    });
    task.promise
      .then((doc) => {
        if (alive) {
          docRef.current = doc;
          setReady(true);
        }
      })
      .catch((e) => alive && onError(e));
    return () => {
      alive = false;
      task.destroy();
    };
  }, [book.id]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false,
      render = null,
      textLayer = null;
    setLoading(true);
    const releasePosition = onRenderStart?.();
    (async () => {
      const p = await docRef.current.getPage(pageIndex + 1);
      if (cancelled) return;
      const scale =
        Math.min(
          1.25,
          Math.max(
            0.45,
            (host.current.parentElement.clientWidth - 70) /
              p.getViewport({ scale: 1 }).width,
          ),
        ) * zoom;
      const vp = p.getViewport({ scale });
      const c = canvas.current;
      c.width = Math.floor(vp.width * devicePixelRatio);
      c.height = Math.floor(vp.height * devicePixelRatio);
      c.style.width = vp.width + "px";
      c.style.height = vp.height + "px";
      host.current.style.width = vp.width + "px";
      layer.current.replaceChildren();
      layer.current.style.setProperty("--total-scale-factor", String(scale));
      setSize({ width: vp.width, height: vp.height });
      render = p.render({
        canvasContext: c.getContext("2d"),
        viewport: vp,
        transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
      });
      await render.promise;
      if (cancelled) return;
      textLayer = new pdfjs.TextLayer({
        textContentSource: await p.getTextContent(),
        container: layer.current,
        viewport: vp,
      });
      await textLayer.render();
      if (!cancelled) {
        setLoading(false);
        releasePosition?.();
        onRendered?.();
      }
    })().catch((e) => {
      if (
        !cancelled &&
        e.name !== "RenderingCancelledException" &&
        e.name !== "AbortException"
      )
        onError(e);
      releasePosition?.();
    });
    return () => {
      cancelled = true;
      releasePosition?.();
      render?.cancel();
      textLayer?.cancel();
    };
  }, [ready, pageIndex, zoom, availableWidth]);
  useEffect(() => {
    if (
      loading ||
      !jump ||
      jump.chapterId !== chapter.id ||
      lastPdfJump.current === jump.key ||
      jump.location ||
      jump.restorePosition
    )
      return;
    lastPdfJump.current = jump.key;
    const body = host.current.parentElement;
    let r;
    if (jump.rects?.length) {
      body.scrollTop +=
        host.current.getBoundingClientRect().top -
        body.getBoundingClientRect().top +
        jump.rects[0].y * size.height -
        body.clientHeight * 0.25;
    } else {
      const compact = chapter.text
          .slice(0, jump.start || 0)
          .replace(/\s/g, "").length,
        layerText = layer.current.textContent;
      let count = 0,
        offset = 0;
      for (; offset < layerText.length && count < compact; offset++)
        if (!/\s/.test(layerText[offset])) count++;
      r = rangeForOffset(
        layer.current,
        offset,
        offset + Math.max(1, (jump.quote || "").replace(/\s/g, "").length),
      );
      if (r)
        body.scrollTop +=
          r.getBoundingClientRect().top -
          body.getBoundingClientRect().top -
          body.clientHeight * 0.25;
    }
    if (r && globalThis.CSS?.highlights && globalThis.Highlight) {
      CSS.highlights.set("arr-reading-jump", new Highlight(r));
      const timer = setTimeout(
        () => CSS.highlights.delete("arr-reading-jump"),
        2200,
      );
      return () => {
        clearTimeout(timer);
        CSS.highlights.delete("arr-reading-jump");
      };
    }
  }, [loading, jump, size]);
  useReaderSelection({
    root: layer,
    chapter,
    enabled: ready && !loading,
    menu: selectionMenu,
    holdSelection,
    onSelection: () => capture(),
  });
  function capture(event) {
    if (event?.button === 2) return;
    const found = readSelectionAnchor(layer.current, chapter);
    if (!found) return;
    const box = host.current.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const rects = [...found.range.getClientRects()]
      .filter((r) => r.width > 0 && r.height > 0)
      .slice(0, 300)
      .map((r) => ({
        x: Math.max(0, Math.min(1, (r.x - box.x) / box.width)),
        y: Math.max(0, Math.min(1, (r.y - box.y) / box.height)),
        width: Math.max(0, Math.min(1, r.width / box.width)),
        height: Math.max(0, Math.min(1, r.height / box.height)),
      }));
    const anchor = { ...found.anchor, rects };
    onSelect(anchor, {
      clientX: found.rect.left,
      clientY: found.rect.bottom + 8,
    });
    return anchor;
  }
  const marks = records
    .filter(
      (r) =>
        !r.deletedAt &&
        r.anchor?.chapterId === chapter.id &&
        annotationAppearance(r).style !== "none",
    )
    .flatMap((record) =>
      (record.anchor.rects || []).map((rect) => ({
        ...rect,
        recordId: record.id,
        annotation: annotationAppearance(record),
      })),
    );
  return (
    <>
      <div
        className="pdfbox"
        ref={host}
        onContextMenu={(e) => {
          const box = host.current.getBoundingClientRect(),
            record = pdfAnnotationAt(
              records,
              chapter.id,
              (e.clientX - box.left) / box.width,
              (e.clientY - box.top) / box.height,
            );
          if (record) {
            e.preventDefault();
            onSelect(record.anchor, {
              clientX: e.clientX,
              clientY: e.clientY,
              mode: "context",
              recordId: record.id,
            });
          } else {
            const native = window.getSelection(),
              range =
                native?.rangeCount && !native.isCollapsed
                  ? native.getRangeAt(0)
                  : null;
            if (
              !range ||
              ![...range.getClientRects()].some(
                (a) =>
                  e.clientX >= a.left &&
                  e.clientX <= a.right &&
                  e.clientY >= a.top &&
                  e.clientY <= a.bottom,
              )
            )
              return;
            const anchor = capture();
            if (anchor) {
              e.preventDefault();
              onSelect(anchor, {
                clientX: e.clientX,
                clientY: e.clientY,
                mode: "context",
              });
            }
          }
        }}
      >
        <canvas ref={canvas} />
        <div className="pdftext" ref={layer} />
        {marks.map((r, i) => (
          <div
            key={i}
            className="pdfmark arr-pdf-annotation"
            data-annotation-style={r.annotation.style}
            data-annotation-color={r.annotation.color}
            style={{
              left: r.x * size.width,
              top: r.y * size.height,
              width: r.width * size.width,
              height: r.height * size.height,
            }}
          />
        ))}
      </div>
      {loading && <p>{t("loading")}</p>}
    </>
  );
}
