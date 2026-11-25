import { useEffect, useRef } from "react";
import { selectionAnchor } from "../shared/selection-anchors.js";
export function ownedSelectionRange(root) {
  const sel = root?.ownerDocument.defaultView.getSelection();
  if (
    !root ||
    !sel ||
    sel.isCollapsed ||
    !sel.rangeCount ||
    (!root.contains(sel.anchorNode) && !root.contains(sel.focusNode))
  )
    return null;
  const original = sel.getRangeAt(0);
  if (!original.intersectsNode(root)) return null;
  const range = original.cloneRange(),
    contents = root.ownerDocument.createRange();
  contents.selectNodeContents(root);
  if (range.compareBoundaryPoints(Range.START_TO_START, contents) < 0)
    range.setStart(contents.startContainer, contents.startOffset);
  if (range.compareBoundaryPoints(Range.END_TO_END, contents) > 0)
    range.setEnd(contents.endContainer, contents.endOffset);
  return range.collapsed ? null : range;
}
export function domRangeOffsets(root, range) {
  const before = root.ownerDocument.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  before.setEnd(range.endContainer, range.endOffset);
  return { start, end: before.toString().length };
}
export function readSelectionAnchor(root, chapter) {
  const range = ownedSelectionRange(root);
  if (!range || !chapter) return null;
  const bounds = domRangeOffsets(root, range),
    anchor = selectionAnchor({
      chapterId: chapter.id,
      canonical: chapter.text,
      domText: root.textContent,
      ...bounds,
    });
  return anchor ? { anchor, rect: range.getBoundingClientRect(), range } : null;
}
export function useReaderSelection({
  root,
  chapter,
  enabled,
  onSelection,
  menu,
  holdSelection,
}) {
  const latest = useRef(null);
  latest.current = { root, chapter, enabled, onSelection, menu, holdSelection };
  useEffect(() => {
    if (!enabled) return;
    const doc = root.current?.ownerDocument || document;
    let dragging = false,
      release = null,
      timer = null,
      frame = null;
    function capture() {
      const p = latest.current;
      if (
        !p.enabled ||
        !p.root.current ||
        dragging ||
        p.menu?.mode === "context"
      )
        return;
      const found = readSelectionAnchor(p.root.current, p.chapter);
      if (!found) return;
      const old = p.menu?.anchor;
      if (
        old &&
        old.chapterId === found.anchor.chapterId &&
        old.start === found.anchor.start &&
        old.end === found.anchor.end
      )
        return;
      p.onSelection(found.anchor, {
        clientX: found.rect.left,
        clientY: found.rect.bottom + 8,
      });
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(capture);
      }, 60);
    }
    function down(e) {
      if (
        !latest.current.enabled ||
        !latest.current.root.current?.contains(e.target) ||
        e.button !== 0
      )
        return;
      dragging = true;
      release?.();
      release = latest.current.holdSelection?.();
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      release?.();
      release = null;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(capture);
    }
    function change() {
      if (!dragging) schedule();
    }
    function blur() {
      dragging = false;
      release?.();
      release = null;
    }
    doc.addEventListener("pointerdown", down, true);
    doc.addEventListener("pointerup", up, true);
    doc.addEventListener("pointercancel", blur, true);
    doc.addEventListener("selectionchange", change);
    doc.defaultView.addEventListener("blur", blur);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      release?.();
      doc.removeEventListener("pointerdown", down, true);
      doc.removeEventListener("pointerup", up, true);
      doc.removeEventListener("pointercancel", blur, true);
      doc.removeEventListener("selectionchange", change);
      doc.defaultView.removeEventListener("blur", blur);
    };
  }, [chapter?.id, enabled]);
}
