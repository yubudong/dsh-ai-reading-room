import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createStore } from "../src/host/store.js";
import { resolveShortcut, reserved } from "../src/shared/shortcuts.js";
const req = () => randomUUID();
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arr-undo-"));
  let global,
    fail = false;
  const unit = {
    loadAll: async () => ({ global: structuredClone(global), tables: {} }),
    setGlobal: async (x) => {
      if (fail) throw new Error("TEST_STORAGE_FAILED");
      global = structuredClone(x);
    },
    close: async () => {},
  };
  let store = await createStore(unit, root);
  const book = (
    await store.importBytes(
      Buffer.from("A meaningful passage.\nA second passage."),
      "undo.txt",
      req(),
    )
  ).book;
  t.after(async () => {
    await store.close();
    const real = await fs.realpath(root);
    assert.ok(
      real.startsWith((await fs.realpath(os.tmpdir())) + path.sep) &&
        path.basename(real).startsWith("arr-undo-"),
    );
    await fs.rm(real, { recursive: true });
  });
  return {
    get store() {
      return store;
    },
    book,
    fail(value) {
      fail = value;
    },
    reopen: async () => {
      await store.close();
      store = await createStore(unit, root);
    },
  };
}
const anchor = { chapterId: "c0", start: 0, end: 1, quote: "A" };
async function state(f, bookId = f.book.id) {
  return f.store.action({ action: "annotationState", bookId });
}
async function create(f, color = "yellow", bookId = f.book.id) {
  return f.store.action({
    action: "annotationAction",
    bookId,
    item: { anchor, annotation: { style: "highlight", color } },
    requestId: req(),
  });
}
async function replay(f, direction, bookId = f.book.id, requestId = req()) {
  return f.store.action({
    action: "annotationReplay",
    bookId,
    item: { direction },
    requestId,
  });
}
async function style(f, id, appearance) {
  const r = (await state(f)).items.find((r) => r.id === id);
  return f.store.action({
    action: "annotationAction",
    bookId: f.book.id,
    id,
    revision: r.revision,
    item: { annotation: appearance },
    requestId: req(),
  });
}
test("new marks undo to recoverable trash and redo with the same identity and source", async (t) => {
  const f = await setup(t),
    added = await create(f),
    original = (await state(f)).items[0];
  assert.equal(added.history.canUndo, true);
  await replay(f, "undo");
  let s = await state(f);
  assert.ok(s.items[0].deletedAt);
  assert.equal(s.history.canRedo, true);
  await replay(f, "redo");
  s = await state(f);
  assert.equal(s.items[0].id, original.id);
  assert.equal(s.items[0].deletedAt, null);
  assert.deepEqual(s.items[0].anchor, original.anchor);
  assert.equal(s.items[0].createdAt, original.createdAt);
});
test("multiple color and underline actions can be undone and redone in order", async (t) => {
  const f = await setup(t),
    r = await create(f);
  await style(f, r.recordId, { style: "highlight", color: "pink" });
  await style(f, r.recordId, { style: "underline", color: "pink" });
  await replay(f, "undo");
  assert.equal((await state(f)).items[0].annotation.style, "highlight");
  await replay(f, "undo");
  assert.equal((await state(f)).items[0].annotation.color, "yellow");
  await replay(f, "undo");
  assert.ok((await state(f)).items[0].deletedAt);
  await replay(f, "redo");
  await replay(f, "redo");
  await replay(f, "redo");
  assert.deepEqual((await state(f)).items[0].annotation, {
    style: "underline",
    color: "pink",
  });
});
test("removal, undo and redo preserve attached note content and later edits", async (t) => {
  const f = await setup(t),
    r = await create(f);
  let current = (await state(f)).items[0];
  await f.store.action({
    action: "saveRecord",
    bookId: f.book.id,
    id: current.id,
    revision: current.revision,
    item: { kind: "question", body: "My own question" },
    requestId: req(),
  });
  current = (await state(f)).items[0];
  await f.store.action({
    action: "annotationAction",
    bookId: f.book.id,
    id: current.id,
    revision: current.revision,
    item: { operation: "remove" },
    requestId: req(),
  });
  current = (await state(f)).items[0];
  assert.equal(current.annotation.style, "none");
  assert.equal(current.deletedAt, null);
  await f.store.action({
    action: "saveRecord",
    bookId: f.book.id,
    id: current.id,
    revision: current.revision,
    item: { body: "A revised question" },
    requestId: req(),
  });
  await replay(f, "undo");
  current = (await state(f)).items[0];
  assert.equal(current.body, "A revised question");
  assert.equal(current.annotation.color, "yellow");
  assert.equal(current.kind, "question");
  await replay(f, "redo");
  assert.equal((await state(f)).items[0].body, "A revised question");
  assert.equal((await state(f)).items[0].annotation.style, "none");
});
test("undo of creation keeps a note added later instead of deleting it", async (t) => {
  const f = await setup(t),
    r = await create(f);
  const current = (await state(f)).items[0];
  await f.store.action({
    action: "saveRecord",
    bookId: f.book.id,
    id: current.id,
    revision: current.revision,
    item: { body: "Keep this reflection" },
    requestId: req(),
  });
  await replay(f, "undo");
  let note = (await state(f)).items[0];
  assert.equal(note.deletedAt, null);
  assert.equal(note.annotation.style, "none");
  assert.equal(note.body, "Keep this reflection");
  await replay(f, "redo");
  note = (await state(f)).items[0];
  assert.equal(note.body, "Keep this reflection");
  assert.equal(note.annotation.style, "highlight");
});
test("new edits clear redo while a no-op color choice does not", async (t) => {
  const f = await setup(t),
    r = await create(f);
  await style(f, r.recordId, { style: "highlight", color: "blue" });
  await replay(f, "undo");
  const noop = await style(f, r.recordId, {
    style: "highlight",
    color: "yellow",
  });
  assert.equal(noop.changed, false);
  assert.equal(noop.history.canRedo, true);
  await style(f, r.recordId, { style: "highlight", color: "green" });
  assert.equal((await state(f)).history.canRedo, false);
  await assert.rejects(() => replay(f, "redo"), /ANNOTATION_HISTORY_EMPTY/);
});
test("out-of-band style changes are not overwritten, including changes back to the same color", async (t) => {
  const f = await setup(t),
    added = await create(f);
  for (const color of ["blue", "yellow"]) {
    const r = (await state(f)).items[0];
    await f.store.action({
      action: "annotateRecord",
      bookId: f.book.id,
      id: r.id,
      revision: r.revision,
      item: { annotation: { style: "highlight", color } },
      requestId: req(),
    });
  }
  const before = (await state(f)).items[0];
  assert.equal((await state(f)).history.canUndo, false);
  await assert.rejects(() => replay(f, "undo"), /ANNOTATION_HISTORY_CONFLICT/);
  assert.deepEqual((await state(f)).items[0], before);
});
test("undo history is isolated by book and remains available after reopening", async (t) => {
  const f = await setup(t),
    other = (
      await f.store.importBytes(
        Buffer.from("A different book."),
        "other.txt",
        req(),
      )
    ).book;
  await create(f);
  await create(f, "blue", other.id);
  await replay(f, "undo", other.id);
  assert.equal((await state(f)).items[0].deletedAt, null);
  await f.reopen();
  assert.equal((await state(f)).history.canUndo, true);
  assert.equal((await state(f, other.id)).history.canRedo, true);
});
test("annotation requests and replay retries are idempotent", async (t) => {
  const f = await setup(t),
    requestId = req(),
    args = {
      action: "annotationAction",
      bookId: f.book.id,
      item: { anchor, annotation: { style: "highlight", color: "yellow" } },
      requestId,
    };
  const a = await f.store.action(args),
    b = await f.store.action(args);
  assert.equal(a.recordId, b.recordId);
  assert.equal((await state(f)).items.length, 1);
  await create(f);
  assert.equal((await state(f)).items.length, 1);
  const undoId = req();
  await replay(f, "undo", f.book.id, undoId);
  await replay(f, "undo", f.book.id, undoId);
  assert.equal((await state(f)).history.undoCount, 0);
  assert.equal((await state(f)).history.redoCount, 1);
});
test("failed storage leaves both marks and undo stacks unchanged", async (t) => {
  const f = await setup(t);
  await create(f);
  const before = await state(f);
  f.fail(true);
  await assert.rejects(() => replay(f, "undo"), /TEST_STORAGE_FAILED/);
  f.fail(false);
  assert.deepEqual(await state(f), before);
  await replay(f, "undo");
  assert.ok((await state(f)).items[0].deletedAt);
});
test("restoring a backup clears stale command history and retains annotations", async (t) => {
  const f = await setup(t);
  await create(f, "purple");
  const backup = await f.store.backup(true);
  await replay(f, "undo");
  await f.store.restore(backup, req(), true);
  const s = await state(f);
  assert.equal(s.items[0].annotation.color, "purple");
  assert.equal(s.items[0].deletedAt, null);
  assert.equal(s.history.canUndo, false);
  assert.equal(s.history.canRedo, false);
});
test("undo shortcuts apply to reader actions while editors, dialogs and composition retain native undo", () => {
  const key = {
    code: "KeyZ",
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  };
  assert.equal(resolveShortcut(key), "undoAnnotation");
  assert.equal(resolveShortcut({ ...key, shiftKey: true }), "redoAnnotation");
  assert.equal(resolveShortcut(key, { editable: true }), null);
  assert.equal(resolveShortcut(key, { modal: true }), null);
  assert.equal(resolveShortcut({ ...key, isComposing: true }), null);
  assert.equal(resolveShortcut({ ...key, defaultPrevented: true }), null);
  assert.equal(reserved("Mod+KeyW"), true);
});

test("an undo request for an older stack head cannot undo a newer operation", async (t) => {
  const f = await setup(t),
    first = await create(f);
  const expectedId = first.history.undoId;
  await style(f, first.recordId, { style: "highlight", color: "blue" });
  const before = await state(f);
  await assert.rejects(
    () =>
      f.store.action({
        action: "annotationReplay",
        bookId: f.book.id,
        item: { direction: "undo", expectedId },
        requestId: req(),
      }),
    /ANNOTATION_HISTORY_CONFLICT/,
  );
  assert.deepEqual(await state(f), before);
});
