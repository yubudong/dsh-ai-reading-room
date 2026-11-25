import { annotationAppearance } from "./annotations.js";
export const ANNOTATION_HISTORY_LIMIT = 50;
export function annotationState(record) {
  return {
    annotation: record.annotation ? { ...record.annotation } : null,
    deleted: !!record.deletedAt,
    generation: record.annotationRevision || 0,
  };
}
export function sameAnnotationState(record, state, checkGeneration = true) {
  if (
    !record ||
    !state ||
    !!record.deletedAt !== state.deleted ||
    (checkGeneration &&
      (record.annotationRevision || 0) !== (state.generation || 0))
  )
    return false;
  const a = annotationAppearance(record),
    b = annotationAppearance({ annotation: state.annotation });
  return a.style === b.style && a.color === b.color;
}
export function annotationHistoryStatus(
  ledger = { undo: [], redo: [] },
  records = {},
  bookId,
) {
  const undo = ledger.undo?.at(-1),
    redo = ledger.redo?.at(-1);
  const valid = (entry, side) =>
    !!entry &&
    records[entry.recordId]?.bookId === bookId &&
    sameAnnotationState(records[entry.recordId], entry[side]);
  return {
    canUndo: valid(undo, "after"),
    canRedo: valid(redo, "before"),
    undoCount: ledger.undo?.length || 0,
    redoCount: ledger.redo?.length || 0,
    undoLabel: undo?.label || "",
    undoId: undo?.id || "",
    redoId: redo?.id || "",
    redoLabel: redo?.label || "",
    blocked:
      (!!undo && !valid(undo, "after")) || (!!redo && !valid(redo, "before")),
  };
}
export function applyAnnotationState(record, target, time) {
  record.history.push({
    body: "",
    annotation: record.annotation,
    at: record.updatedAt,
    revision: record.revision,
    kind: record.kind,
    questionState: record.questionState,
    visualOnly: true,
  });
  if (target.deleted && (record.body.trim() || record.kind !== "highlight")) {
    record.annotation = {
      style: "none",
      color: annotationAppearance(record).color,
    };
    record.deletedAt = null;
  } else {
    record.annotation = target.annotation ? { ...target.annotation } : null;
    record.deletedAt = target.deleted ? time : null;
  }
  record.revision++;
  record.updatedAt = time;
}
export function rememberAnnotationAction(ledger, entry) {
  ledger.undo = [...ledger.undo, entry].slice(-ANNOTATION_HISTORY_LIMIT);
  ledger.redo = [];
}
export function replayAnnotationAction(
  ledger,
  records,
  bookId,
  direction,
  time,
  expectedId,
) {
  const from = direction === "undo" ? ledger.undo : ledger.redo,
    to = direction === "undo" ? ledger.redo : ledger.undo,
    entry = from.at(-1);
  if (!entry) throw new Error("ANNOTATION_HISTORY_EMPTY");
  if (expectedId && entry.id !== expectedId)
    throw new Error("ANNOTATION_HISTORY_CONFLICT");
  const r = records[entry.recordId];
  if (
    !r ||
    r.bookId !== bookId ||
    !sameAnnotationState(r, direction === "undo" ? entry.after : entry.before)
  )
    throw new Error("ANNOTATION_HISTORY_CONFLICT");
  const current = annotationState(r);
  applyAnnotationState(
    r,
    direction === "undo" ? entry.before : entry.after,
    time,
  );
  const applied = annotationState(r);
  from.pop();
  to.push({
    ...entry,
    before: direction === "undo" ? applied : current,
    after: direction === "undo" ? current : applied,
  });
  if (to.length > ANNOTATION_HISTORY_LIMIT) to.shift();
  return r;
}
