export const ANNOTATION_COLORS = ["yellow", "green", "blue", "pink", "purple"];
export const ANNOTATION_PALETTE = {
  yellow: "#efd03b",
  green: "#99dc82",
  blue: "#97b9ff",
  pink: "#fe9bb3",
  purple: "#c5b0fb",
};
export const DEFAULT_ANNOTATION = { style: "highlight", color: "yellow" };
export function annotationAppearance(record) {
  const value = record?.annotation;
  if (
    value &&
    ["highlight", "underline", "none"].includes(value.style) &&
    ANNOTATION_COLORS.includes(value.color)
  )
    return { ...value };
  return { style: "underline", color: "yellow" };
}
export function exactAnnotation(records, anchor) {
  return (
    records
      .filter(
        (r) =>
          !r.deletedAt &&
          r.anchor?.chapterId === anchor?.chapterId &&
          r.anchor?.start === anchor?.start &&
          r.anchor?.end === anchor?.end &&
          r.anchor?.quote === anchor?.quote,
      )
      .sort(compareRecords)
      .at(-1) || null
  );
}
function compareRecords(a, b) {
  return (
    String(a.updatedAt || a.createdAt || "").localeCompare(
      String(b.updatedAt || b.createdAt || ""),
    ) ||
    (a.revision || 0) - (b.revision || 0) ||
    String(a.id).localeCompare(String(b.id))
  );
}
export function annotationSegments(records, chapterId, text) {
  const matching = records
    .filter(
      (r) =>
        !r.deletedAt &&
        r.anchor?.chapterId === chapterId &&
        r.anchor.end > r.anchor.start &&
        r.anchor.start >= 0 &&
        r.anchor.end <= text.length &&
        text.slice(r.anchor.start, r.anchor.end) === r.anchor.quote &&
        annotationAppearance(r).style !== "none",
    )
    .sort(compareRecords);
  const edges = new Map();
  for (const r of matching) {
    for (const [offset, add] of [
      [r.anchor.start, true],
      [r.anchor.end, false],
    ]) {
      if (!edges.has(offset)) edges.set(offset, []);
      edges.get(offset).push({ r, add });
    }
  }
  const points = [...edges.keys()].sort((a, b) => a - b),
    active = new Map(),
    out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i],
      end = points[i + 1];
    for (const { r, add } of edges.get(start)) {
      if (add) active.set(r.id, r);
      else active.delete(r.id);
    }
    if (!active.size || end <= start) continue;
    const entries = [...active.values()].sort(compareRecords),
      top = entries.at(-1),
      appearance = annotationAppearance(top),
      recordIds = entries.map((r) => r.id);
    const last = out.at(-1);
    if (
      last &&
      last.end === start &&
      last.recordId === top.id &&
      last.recordIds.join(",") === recordIds.join(",")
    )
      last.end = end;
    else
      out.push({
        start,
        end,
        recordId: top.id,
        recordIds,
        annotation: appearance,
      });
  }
  return out;
}
export function pdfAnnotationAt(records, chapterId, x, y) {
  return (
    records
      .filter(
        (r) =>
          !r.deletedAt &&
          r.anchor?.chapterId === chapterId &&
          annotationAppearance(r).style !== "none" &&
          r.anchor.rects?.some(
            (a) =>
              x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height,
          ),
      )
      .sort(compareRecords)
      .at(-1) || null
  );
}
export function menuPosition(x, y, width, height, bounds) {
  return {
    left: Math.max(8, Math.min(x, bounds.width - width - 8)),
    top: Math.max(8, Math.min(y, bounds.height - height - 8)),
  };
}
