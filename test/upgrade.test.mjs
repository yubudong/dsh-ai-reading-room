import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { parseBook } from "../src/host/parse.js";
import { createStore } from "../src/host/store.js";
import { fileName, scanDirectory } from "../src/host/library-files.js";
import { resolveShortcut, reserved } from "../src/shared/shortcuts.js";
import {
  MANUAL,
  manualContext,
  isUsageQuestion,
} from "../src/shared/manual.js";
const req = () => randomUUID();
function epub(nav3 = false) {
  const files = {
    "META-INF/container.xml": strToU8(
      '<container><rootfiles><rootfile full-path="O/book.opf"/></rootfiles></container>',
    ),
    "O/book.opf": strToU8(
      `<package><metadata><title>Book</title></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>${nav3 ? '<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>' : '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'}</manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`,
    ),
    "O/one.xhtml": strToU8(
      '<html><head><title>同名转版</title></head><body><p>前置知识。</p><p id="idea">深入理解概念。</p></body></html>',
    ),
    "O/two.xhtml": strToU8(
      "<html><head><title>同名转版</title></head><body><p>第二部分。</p></body></html>",
    ),
  };
  if (nav3)
    files["O/nav.xhtml"] = strToU8(
      '<html><body><nav epub:type="toc"><ol><li><a href="one.xhtml">第一章</a><ol><li><a href="one.xhtml#idea">概念</a></li></ol></li><li><a href="two.xhtml">第二章</a></li></ol></nav></body></html>',
    );
  else
    files["O/toc.ncx"] = strToU8(
      '<ncx><navMap><navPoint><navLabel><text>第一章</text></navLabel><content src="one.xhtml"/><navPoint><navLabel><text>概念</text></navLabel><content src="one.xhtml#idea"/></navPoint></navPoint><navPoint><navLabel><text>第二章</text></navLabel><content src="two.xhtml"/></navPoint></navMap></ncx>',
    );
  return zipSync(files);
}
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arr-upgrade-"));
  let global;
  const unit = {
    loadAll: async () => ({ tables: {}, global: structuredClone(global) }),
    setGlobal: async (x) => {
      global = structuredClone(x);
    },
    close: async () => {},
  };
  const store = await createStore(unit, root);
  t.after(async () => {
    await store.close();
    const real = await fs.realpath(root);
    assert.ok(
      real.startsWith((await fs.realpath(os.tmpdir())) + path.sep) &&
        path.basename(real).startsWith("arr-upgrade-"),
    );
    await fs.rm(real, { recursive: true });
  });
  return {
    store,
    root,
    unit,
    getState: () => structuredClone(global),
    setState: (x) => {
      global = x;
    },
  };
}
test("EPUB 2 NCX and EPUB 3 navigation preserve hierarchy and paragraph targets", async () => {
  for (const v of [false, true]) {
    const doc = await parseBook(epub(v), "book.epub");
    assert.equal(doc.chapters[0].title, "第一章");
    assert.deepEqual(
      doc.toc.map((x) => x.title),
      ["第一章", "概念", "第二章"],
    );
    assert.equal(doc.toc[1].depth, 1);
    assert.equal(doc.toc[1].chapterId, "c0");
    assert.equal(
      doc.chapters[0].text.slice(doc.toc[1].textOffset),
      "深入理解概念。",
    );
  }
});
test("managed filenames preserve extension within filesystem byte limits", () => {
  const name = fileName({
    hash: "a".repeat(64),
    originalName: "很长的图书名称".repeat(60) + ".epub",
  });
  assert.ok(Buffer.byteLength(name) < 255);
  assert.ok(name.endsWith(".epub"));
});
test("migration retains old files, verifies copies and preserves book/annotation identities", async (t) => {
  const { store, root } = await setup(t);
  const b = (await store.importBytes(epub(), "book.epub", req())).book;
  const c = (await store.document(b.id)).chapters[0];
  const record = (
    await store.action({
      action: "saveRecord",
      bookId: b.id,
      item: {
        body: "理解",
        anchor: {
          chapterId: "c0",
          start: 0,
          end: 4,
          quote: c.text.slice(0, 4),
        },
      },
      requestId: req(),
    })
  ).record;
  const old = store.asset(b, ".original"),
    target = path.join(root, "new-library");
  const migration = await store.action({
    action: "migrateLibrary",
    path: target,
    requestId: req(),
  });
  assert.equal(migration.copied, 1);
  assert.ok((await fs.stat(old)).isFile());
  assert.ok((await fs.stat(store.asset(b, ".original"))).isFile());
  assert.equal(
    (await store.action({ action: "records" })).items[0].id,
    record.id,
  );
  assert.equal(
    (await store.action({ action: "open", id: b.id })).book.id,
    b.id,
  );
});
test("folder scanning covers subfolders and linked imports leave originals in place", async (t) => {
  const { store, root } = await setup(t);
  const dir = path.join(root, "source");
  await fs.mkdir(path.join(dir, "nested"), { recursive: true });
  await fs.writeFile(path.join(dir, "one.txt"), "A meaningful passage.");
  await fs.writeFile(path.join(dir, "nested", "two.md"), "# Two\n\nReading.");
  assert.equal(
    (await scanDirectory(dir, { recursive: false })).items.length,
    1,
  );
  assert.equal((await scanDirectory(dir, { recursive: true })).items.length, 2);
  const d = (
    await store.action({
      action: "addDirectory",
      path: dir,
      recursive: true,
      requestId: req(),
    })
  ).directory;
  const refreshed = await store.action({
    action: "refreshDirectory",
    id: d.id,
    requestId: req(),
  });
  assert.equal(refreshed.results.length, 2);
  for (const r of refreshed.results) {
    assert.equal(r.book.storage, "linked");
    assert.ok(
      store.asset(r.book, ".original").startsWith(await fs.realpath(dir)),
    );
  }
});
test("custom methods compile exact previews, keep old versions and round-trip backups", async (t) => {
  const { store } = await setup(t);
  const b = (await store.importBytes(epub(), "book.epub", req())).book;
  const m = (
    await store.action({
      action: "saveMethod",
      item: {
        name: "我的方法",
        prompt: "读《{{book}}》的{{chapter}}：{{selection}}",
      },
      requestId: req(),
    })
  ).method;
  const preview = await store.methodPreview({
    bookId: b.id,
    chapterId: "c0",
    method: m.id,
    language: "zh",
  });
  assert.equal(preview.prompt, "读《Book》的第一章：");
  await store.action({
    action: "saveMethod",
    id: m.id,
    revision: m.revision,
    item: { name: m.name, prompt: "新规则 {{book}}" },
    requestId: req(),
  });
  assert.equal(preview.prompt, "读《Book》的第一章：");
  const updated = (await store.action({ action: "methods" })).items.find(
    (x) => x.id === m.id,
  );
  assert.equal(updated.history[0].prompt, m.prompt);
  await store.action({
    action: "createExercise",
    bookId: b.id,
    method: m.id,
    requestId: req(),
  });
  const backup = await store.backup(true);
  await store.restore(backup, req(), true);
  assert.ok(
    (await store.action({ action: "methods" })).items.find(
      (x) => x.id === m.id,
    ),
  );
});
test("shortcuts are scoped to reader focus and protect inputs, composition and reserved keys", () => {
  const key = {
    code: "Space",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  };
  assert.equal(resolveShortcut(key), "forward");
  assert.equal(resolveShortcut(key, { editable: true }), null);
  assert.equal(resolveShortcut({ ...key, isComposing: true }), null);
  assert.equal(resolveShortcut(key, { modal: true }), null);
  assert.ok(reserved("Mod+KeyW"));
  assert.equal(
    resolveShortcut({ ...key, code: "KeyF", metaKey: true }),
    "find",
  );
  assert.equal(resolveShortcut(key, { overrides: { forward: [] } }), null);
});
test("Bookworm help and both-language guide share current implemented operations", () => {
  assert.ok(
    MANUAL.every((x) => x.title.zh && x.title.en && x.body.zh && x.body.en),
  );
  assert.equal(manualContext("导入", "zh").version, "0.5.3");
  assert.ok(isUsageQuestion("怎么导入目录？"));
  const custom = manualContext("快捷键", "zh", { find: ["KeyS"] });
  assert.deepEqual(custom.shortcuts.find((x) => x.action === "搜索本书").keys, [
    "S",
  ]);
});

test("legacy libraries gain formal contents without changing saved quote offsets", async (t) => {
  const f = await setup(t),
    b = (await f.store.importBytes(epub(), "legacy.epub", req())).book;
  const original = await f.store.document(b.id);
  const anchor = {
    chapterId: "c0",
    start: 0,
    end: 4,
    quote: original.chapters[0].text.slice(0, 4),
  };
  await f.store.action({
    action: "saveRecord",
    bookId: b.id,
    item: { body: "old note", anchor },
    requestId: req(),
  });
  const snapshot = f.getState();
  await fs.copyFile(
    f.store.asset(b, ".original"),
    path.join(f.root, "books", b.hash + ".original"),
  );
  delete snapshot.libraryPath;
  delete snapshot.books[b.id].managedName;
  delete original.toc;
  delete original.navigationVersion;
  original.chapters.forEach((c) => (c.title = "same conversion title"));
  await fs.writeFile(
    path.join(f.root, "books", b.hash + ".json"),
    JSON.stringify(original),
  );
  await f.store.close();
  f.setState(snapshot);
  const upgraded = await createStore(f.unit, f.root);
  try {
    const opened = await upgraded.action({ action: "open", id: b.id });
    assert.equal(opened.toc[0].title, "第一章");
    assert.equal(opened.records[0].anchor.quote, anchor.quote);
    assert.equal(
      (await upgraded.document(b.id)).chapters[0].text,
      original.chapters[0].text,
    );
    assert.ok(
      (
        await fs.stat(upgraded.asset(upgraded.book(b.id), ".original"))
      ).isFile(),
    );
  } finally {
    await upgraded.close();
  }
});
