import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createStore } from "../src/host/store.js";
test("a highlighted passage can become an open question without losing its color or source", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arr-reclassify-"));
  let global;
  const unit = {
    loadAll: async () => ({ global, tables: {} }),
    setGlobal: async (x) => {
      global = structuredClone(x);
    },
    close: async () => {},
  };
  const store = await createStore(unit, root);
  try {
    const b = (
      await store.importBytes(
        Buffer.from("A question worth keeping."),
        "sample.txt",
        randomUUID(),
      )
    ).book;
    const r = (
      await store.action({
        action: "saveRecord",
        bookId: b.id,
        item: {
          kind: "highlight",
          body: "",
          anchor: { chapterId: "c0", start: 0, end: 1, quote: "A" },
          annotation: { style: "highlight", color: "blue" },
        },
        requestId: randomUUID(),
      })
    ).record;
    const next = (
      await store.action({
        action: "saveRecord",
        bookId: b.id,
        id: r.id,
        revision: r.revision,
        item: { kind: "question", body: "Can I explain this?" },
        requestId: randomUUID(),
      })
    ).record;
    assert.equal(next.kind, "question");
    assert.equal(next.questionState, "open");
    assert.deepEqual(next.anchor, r.anchor);
    assert.deepEqual(next.annotation, r.annotation);
    assert.equal(next.history[0].kind, "highlight");
  } finally {
    await store.close();
    const real = await fs.realpath(root);
    assert.ok(
      real.startsWith((await fs.realpath(os.tmpdir())) + path.sep) &&
        path.basename(real).startsWith("arr-reclassify-"),
    );
    await fs.rm(real, { recursive: true });
  }
});
