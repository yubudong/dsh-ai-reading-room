import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createStore } from "../src/host/store.js";
import {
  annotationAppearance,
  annotationSegments,
  pdfAnnotationAt,
  ANNOTATION_COLORS,
  menuPosition,
} from "../src/shared/annotations.js";
import {
  shouldShowMethodIntro,
  prepareReadingTurn,
} from "../src/shared/methodology-details.js";
import { BUILTIN_METHODS } from "../src/shared/method-library.js";
const req = () => randomUUID();
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arr-annotation-"));
  let global;
  const unit = {
    loadAll: async () => ({ global: structuredClone(global), tables: {} }),
    setGlobal: async (x) => {
      global = structuredClone(x);
    },
    close: async () => {},
  };
  let store = await createStore(unit, root);
  t.after(async () => {
    await store.close();
    const real = await fs.realpath(root);
    assert.ok(
      real.startsWith((await fs.realpath(os.tmpdir())) + path.sep) &&
        path.basename(real).startsWith("arr-annotation-"),
    );
    await fs.rm(real, { recursive: true });
  });
  const book = (
    await store.importBytes(
      Buffer.from("abcdef\nReading and reflection."),
      "sample.txt",
      req(),
    )
  ).book;
  return {
    get store() {
      return store;
    },
    book,
    reopen: async (edit) => {
      await store.close();
      if (edit) edit(global);
      store = await createStore(unit, root);
    },
  };
}
const anchor = { chapterId: "c0", start: 0, end: 4, quote: "abcd" };
test("five colors and underline retain the same note, anchor and content history", async (t) => {
  const f = await setup(t);
  let r = (
    await f.store.action({
      action: "saveRecord",
      bookId: f.book.id,
      item: {
        kind: "note",
        body: "My understanding",
        anchor,
        annotation: { style: "highlight", color: "yellow" },
      },
      requestId: req(),
    })
  ).record;
  const original = structuredClone(r);
  for (const color of ANNOTATION_COLORS) {
    r = (
      await f.store.action({
        action: "annotateRecord",
        bookId: f.book.id,
        id: r.id,
        revision: r.revision,
        item: { annotation: { style: "highlight", color } },
        requestId: req(),
      })
    ).record;
    assert.equal(r.body, original.body);
    assert.deepEqual(r.anchor, original.anchor);
    assert.equal(r.createdAt, original.createdAt);
    assert.equal(r.annotation.color, color);
  }
  r = (
    await f.store.action({
      action: "annotateRecord",
      id: r.id,
      revision: r.revision,
      item: { annotation: { style: "underline", color: "blue" } },
      requestId: req(),
    })
  ).record;
  assert.equal(r.annotation.style, "underline");
  assert.equal(r.history.length, 6);
  assert.equal(r.history[0].annotation.color, "yellow");
  await assert.rejects(
    () =>
      f.store.action({
        action: "annotateRecord",
        id: r.id,
        revision: 1,
        item: { annotation: { style: "highlight", color: "pink" } },
        requestId: req(),
      }),
    /REVISION_CONFLICT/,
  );
});
test("removing a visual mark preserves its note while trash remains recoverable for pure highlights", async (t) => {
  const f = await setup(t);
  let r = (
    await f.store.action({
      action: "saveRecord",
      bookId: f.book.id,
      item: { body: "Keep me", anchor },
      requestId: req(),
    })
  ).record;
  r = (
    await f.store.action({
      action: "annotateRecord",
      id: r.id,
      revision: r.revision,
      item: { annotation: { style: "none", color: "yellow" } },
      requestId: req(),
    })
  ).record;
  assert.equal(r.body, "Keep me");
  assert.equal(annotationSegments([r], "c0", "abcdef").length, 0);
  assert.equal((await f.store.action({ action: "records" })).items.length, 1);
  await f.store.action({
    action: "trashRecord",
    id: r.id,
    revision: r.revision,
    requestId: req(),
  });
  assert.equal(
    (await f.store.action({ action: "records" })).items[0].deletedAt !== null,
    true,
  );
});
test("legacy notes keep source offsets and a stable underline fallback", async (t) => {
  const f = await setup(t);
  const r = (
    await f.store.action({
      action: "saveRecord",
      bookId: f.book.id,
      item: { body: "Legacy note", anchor },
      requestId: req(),
    })
  ).record;
  await f.reopen((state) => {
    delete state.records[r.id].annotation;
  });
  const old = (await f.store.action({ action: "records" })).items[0];
  assert.deepEqual(annotationAppearance(old), {
    style: "underline",
    color: "yellow",
  });
  assert.equal(old.anchor.quote, "abcd");
  assert.equal(old.body, "Legacy note");
  assert.equal(annotationSegments([old], "c0", "abcdef")[0].recordId, r.id);
});
test("overlapping colors keep record identities and reject stale quotations", () => {
  const a = {
      id: "a",
      updatedAt: "2026-01-01",
      anchor: { chapterId: "c0", start: 0, end: 4, quote: "abcd" },
      annotation: { style: "highlight", color: "yellow" },
    },
    b = {
      id: "b",
      updatedAt: "2026-01-02",
      anchor: { chapterId: "c0", start: 2, end: 6, quote: "cdef" },
      annotation: { style: "highlight", color: "pink" },
    };
  const parts = annotationSegments([a, b], "c0", "abcdef");
  assert.deepEqual(
    parts.map((x) => [x.start, x.end, x.recordId]),
    [
      [0, 2, "a"],
      [2, 4, "b"],
      [4, 6, "b"],
    ],
  );
  assert.deepEqual(parts[1].recordIds, ["a", "b"]);
  assert.equal(
    annotationSegments(
      [{ ...a, anchor: { ...a.anchor, quote: "wrong" } }],
      "c0",
      "abcdef",
    ).length,
    0,
  );
});
test("PDF marks use normalized hit rectangles and ignore removed marks", () => {
  const r = {
    id: "r",
    anchor: {
      chapterId: "c1",
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
    },
    annotation: { style: "highlight", color: "green" },
  };
  assert.equal(pdfAnnotationAt([r], "c1", 0.2, 0.25).id, "r");
  assert.equal(pdfAnnotationAt([r], "c1", 0.8, 0.25), null);
  assert.equal(
    pdfAnnotationAt(
      [{ ...r, annotation: { style: "none", color: "green" } }],
      "c1",
      0.2,
      0.25,
    ),
    null,
  );
  assert.deepEqual(
    menuPosition(900, 900, 250, 300, { width: 1000, height: 700 }),
    { left: 742, top: 392 },
  );
});
test("built-in personal versions restore defaults with monotonic revisions and introduction preferences", async (t) => {
  const f = await setup(t);
  let m = (await f.store.action({ action: "methods" })).items.find(
    (x) => x.id === "feynman",
  );
  assert.ok(m.scenario.zh && m.usage.en);
  const before = m.revision;
  const updated = (
    await f.store.action({
      action: "saveMethod",
      id: m.id,
      revision: m.revision,
      item: {
        name: "My teach-back",
        description: "Explain first",
        prompt: "Help me understand {{book}}",
        scenario: "Unclear concepts",
        usage: "Explain, teach back, verify",
      },
      requestId: req(),
    })
  ).method;
  assert.equal(updated.revision, before + 1);
  assert.equal(
    (await f.store.action({ action: "methods" })).items.find(
      (x) => x.id === m.id,
    ).personalized,
    true,
  );
  await f.store.action({
    action: "methodIntro",
    id: m.id,
    item: { skip: true },
    requestId: req(),
  });
  await f.store.action({
    action: "resetMethod",
    id: m.id,
    revision: updated.revision,
    requestId: req(),
  });
  const state = await f.store.action({ action: "methods" }),
    restored = state.items.find((x) => x.id === m.id);
  assert.equal(restored.personalized, false);
  assert.ok(restored.revision > updated.revision);
  assert.deepEqual(
    restored.prompt,
    BUILTIN_METHODS.find((x) => x.id === m.id).prompt,
  );
  assert.ok(restored.history.some((x) => x.prompt === updated.prompt));
  assert.equal(shouldShowMethodIntro(restored, state.methodIntro[m.id]), false);
  assert.equal(shouldShowMethodIntro(restored, undefined), true);
  assert.equal(
    shouldShowMethodIntro(restored, { skip: true, seenRevision: 0 }),
    true,
  );
});
test("annotation colors, method overrides and first-use settings survive full backup restore", async (t) => {
  const f = await setup(t);
  await f.store.action({
    action: "saveRecord",
    bookId: f.book.id,
    item: {
      anchor,
      annotation: { style: "highlight", color: "purple" },
      body: "A purple note",
    },
    requestId: req(),
  });
  const m = (await f.store.action({ action: "methods" })).items.find(
    (x) => x.id === "hunt",
  );
  await f.store.action({
    action: "saveMethod",
    id: m.id,
    revision: m.revision,
    item: { name: "My explore", prompt: "One lead at a time {{selection}}" },
    requestId: req(),
  });
  await f.store.action({
    action: "methodIntro",
    id: m.id,
    item: { skip: true },
    requestId: req(),
  });
  const backup = await f.store.backup(true);
  await f.store.restore(backup, req(), true);
  assert.equal(
    (await f.store.action({ action: "records" })).items[0].annotation.color,
    "purple",
  );
  const methods = await f.store.action({ action: "methods" });
  assert.equal(methods.items.find((x) => x.id === "hunt").personalized, true);
  assert.equal(methods.methodIntro.hunt.skip, true);
});
test("reading turn keeps the user message separate from temporary prompt instructions", () => {
  const a = prepareReadingTurn({
    message: "My question",
    textOverride: "Read this with me",
    promptOverride: "Explain before asking questions",
  });
  assert.equal(a.text, "Read this with me");
  assert.equal(a.override, "Explain before asking questions");
  const b = prepareReadingTurn({
    message: "My question",
    promptOverride: null,
  });
  assert.equal(b.text, "My question");
  assert.equal(b.override, undefined);
});
