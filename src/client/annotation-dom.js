import { annotationSegments } from "../shared/annotations.js";
import { selectionAnchor } from "../shared/selection-anchors.js";
export function renderAnnotations(
  root,
  records,
  chapterId,
  canonical = root.textContent,
) {
  const domText = root.textContent;
  if (domText !== canonical)
    records = records.map((r) => {
      if (!r.anchor || r.anchor.chapterId !== chapterId) return r;
      const mapped = selectionAnchor({
        chapterId,
        canonical: domText,
        domText: canonical,
        start: r.anchor.start,
        end: r.anchor.end,
      });
      return mapped
        ? { ...r, anchor: mapped }
        : { ...r, deletedAt: r.deletedAt || "unmapped" };
    });
  const intervals = annotationSegments(records, chapterId, root.textContent);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
    segments = [];
  let node,
    at = 0;
  while ((node = walker.nextNode())) {
    const end = at + node.textContent.length;
    for (const entry of intervals) {
      const from = Math.max(at, entry.start),
        to = Math.min(end, entry.end);
      if (from < to)
        segments.push({ node, start: from - at, end: to - at, entry });
    }
    at = end;
  }
  for (const { node, start, end, entry } of segments.reverse()) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const mark = document.createElement("mark");
    mark.className = "arr-text-annotation";
    mark.dataset.annotationStyle = entry.annotation.style;
    mark.dataset.annotationColor = entry.annotation.color;
    mark.dataset.recordId = entry.recordId;
    mark.dataset.recordIds = JSON.stringify(entry.recordIds);
    range.surroundContents(mark);
  }
}
