import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { parseBook, plain, checkedZip } from "../src/host/parse.js";
import { createStore } from "../src/host/store.js";
import { foldDiscussion, METHODS } from "../src/host/spirit.js";
function epub() {
  return zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(
      '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    ),
    "OPS/book.opf": strToU8(
      '<package><metadata><dc:title xmlns:dc="x">测试书 / Test book</dc:title><dc:creator xmlns:dc="x">Fixture Author</dc:creator></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>',
    ),
    "OPS/one.xhtml": strToU8(
      '<html><head><title>Chapter one</title></head><body><h1 id="one">概念 &amp; 例子</h1><p>理解一个概念，需要说明其边界。</p><p>Reading and reflection.</p><script>fetch("https://evil.invalid")</script><img src="https://evil.invalid/a.png" onerror="alert(1)"/><a href="javascript:alert(1)">bad</a></body></html>',
    ),
  });
}
function pdf(text = "Reading and reflection.") {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 16 Tf 40 240 Td (${text}) Tj ET`;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let s = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(s));
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = Buffer.byteLength(s);
  s +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(s);
}
function memory() {
  let global;
  return {
    loadAll: async () => ({ tables: {}, global: structuredClone(global) }),
    setGlobal: async (x) => {
      global = structuredClone(x);
    },
    close: async () => {},
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arr-test-"));
  const unit = memory();
  let store = await createStore(unit, root);
  t.after(async () => {
    await store.close();
    const real = await fs.realpath(root);
    assert.ok(path.basename(real).startsWith("arr-test-"));
    assert.ok(real.startsWith((await fs.realpath(os.tmpdir())) + path.sep));
    await fs.rm(real, { recursive: true });
  });
  return {
    root,
    unit,
    get store() {
      return store;
    },
    reopen: async () => {
      await store.close();
      store = await createStore(unit, root);
    },
  };
}
const req = () => randomUUID();
test("EPUB follows spine, extracts metadata, preserves text and removes active content", async () => {
  const b = await parseBook(epub(), "fixture.epub");
  assert.equal(b.title, "测试书 / Test book");
  assert.equal(b.author, "Fixture Author");
  assert.match(b.chapters[0].text, /概念 & 例子/);
  assert.doesNotMatch(
    b.chapters[0].html,
    /onerror|javascript:|https:\/\/evil|<script/,
  );
  assert.equal(plain("<p>A &amp; B</p>"), "A & B");
});
test("TXT and Markdown retain usable bilingual text", async () => {
  for (const name of ["fixture.txt", "fixture.md"]) {
    const b = await parseBook(
      Buffer.from("# 阅读\n\nRead & reflect.\n\n理解之后再判断。"),
      name,
    );
    assert.ok(b.hasText);
    assert.match(b.chapters[0].text, /Read & reflect/);
  }
});
test("PDF extraction works without native canvas", async () => {
  const b = await parseBook(pdf(), "fixture.pdf");
  assert.equal(b.chapters.length, 1);
  assert.match(b.chapters[0].text, /Reading and reflection/);
  assert.ok(b.hasText);
});
test("malformed and unsafe containers fail clearly", async () => {
  await assert.rejects(
    () => parseBook(Buffer.from("bad"), "bad.pdf"),
    /BAD_PDF/,
  );
  assert.throws(
    () => checkedZip(zipSync({ "../evil": strToU8("oops") })),
    /ZIP_LIMIT/,
  );
  await assert.rejects(() => parseBook(epub(), "x.mobi"), /UNSUPPORTED_FORMAT/);
});
test("deduplication, exact anchors, idempotence, revision conflicts, history, trash and persistence", async (t) => {
  const f = await fixture(t),
    s = f.store;
  const result = await s.importBytes(epub(), "test.epub", req());
  const b = result.book;
  assert.equal((await s.importBytes(epub(), "copy.epub", req())).book.id, b.id);
  const c = (await s.action({ action: "chapter", id: b.id, chapterId: "c0" }))
    .chapter;
  const start = c.text.indexOf("理解"),
    end = start + 8;
  const input = {
    action: "saveRecord",
    bookId: b.id,
    item: {
      kind: "reflection",
      body: "我的理解",
      anchor: { chapterId: "c0", start, end, quote: c.text.slice(start, end) },
    },
    requestId: req(),
  };
  const r = (await s.action(input)).record;
  assert.equal((await s.action(input)).record.id, r.id);
  await assert.rejects(
    () =>
      s.action({
        ...input,
        item: {
          ...input.item,
          anchor: { ...input.item.anchor, quote: "错误" },
        },
        requestId: req(),
      }),
    /ANCHOR_MISMATCH/,
  );
  const edit = await s.action({
    action: "saveRecord",
    id: r.id,
    bookId: b.id,
    revision: r.revision,
    item: { body: "修正后的理解", anchor: r.anchor },
    requestId: req(),
  });
  assert.equal(edit.record.history.length, 1);
  await assert.rejects(
    () =>
      s.action({
        action: "saveRecord",
        id: r.id,
        bookId: b.id,
        revision: 1,
        item: { body: "过期修改" },
        requestId: req(),
      }),
    /REVISION_CONFLICT/,
  );
  await s.action({
    action: "trashRecord",
    id: r.id,
    revision: 2,
    requestId: req(),
  });
  await s.action({
    action: "trashRecord",
    id: r.id,
    revision: 3,
    restore: true,
    requestId: req(),
  });
  await f.reopen();
  assert.equal(
    (await f.store.action({ action: "records" })).items[0].body,
    "修正后的理解",
  );
  const hits = await f.store.search("概念", b.id);
  assert.equal(hits.items[0].chapterId, "c0");
});
test("exercise stages and portable backup survive restore, with native session identities reset", async (t) => {
  const f = await fixture(t),
    s = f.store;
  const b = (await s.importBytes(epub(), "test.epub", req())).book;
  const x = (
    await s.action({
      action: "createExercise",
      bookId: b.id,
      method: "feynman",
      goal: "解释边界",
      requestId: req(),
    })
  ).exercise;
  await s.writeExercise(x.id, (e) => {
    e.sessionId = "native-session";
    e.rows = [
      { id: "message", role: "assistant", text: "讨论结果", time: Date.now() },
    ];
  });
  await s.action({
    action: "saveExercise",
    id: x.id,
    revision: 1,
    item: { stage: 2, status: "paused" },
    requestId: req(),
  });
  const backup = await s.backup(true);
  const preview = await s.previewRestore(backup);
  assert.equal(preview.summary.books, 1);
  await s.restore(backup, req(), true);
  const restored = (await s.action({ action: "exercise", id: x.id })).exercise;
  assert.equal(restored.status, "paused");
  assert.equal(restored.stage, 2);
  assert.equal(restored.sessionId, "");
  assert.equal(restored.rows[0].text, "讨论结果");
  assert.ok((await fs.readdir(path.join(f.root, "backups"))).length);
});
test("unknown backup versions and tampered originals are rejected", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    () =>
      f.store.previewRestore(
        zipSync({
          "manifest.json": strToU8(
            JSON.stringify({ format: "dsh-ai-reading-room", version: 99 }),
          ),
        }),
      ),
    /BACKUP_VERSION/,
  );
  const b = (await f.store.importBytes(epub(), "test.epub", req())).book;
  const files = checkedZip(await f.store.backup(true));
  files["books/" + b.hash + ".original"] = strToU8("tampered original");
  await assert.rejects(
    () => f.store.previewRestore(zipSync(files)),
    /BACKUP_HASH/,
  );
});
test("discussion projection ignores unrelated events and tracks durable rows", () => {
  const s = { rows: [], seq: -1, busy: false, outcome: null };
  assert.equal(foldDiscussion(s, { type: "request/header" }), s);
  const u = foldDiscussion(s, {
    type: "user/message",
    seq: 1,
    time: 1,
    data: {
      id: "m1",
      content: [
        { type: "text", text: "我的解释" },
        { type: "text", text: "private context" },
      ],
    },
  });
  assert.equal(u.rows[0].text, "我的解释");
  const a = foldDiscussion(u, {
    type: "assistant/message",
    seq: 2,
    time: 2,
    data: {
      message: { id: "m2", content: [{ type: "text", text: "具体追问" }] },
    },
  });
  assert.equal(a.rows.length, 2);
  for (const m of ["hunt", "feynman", "debate"])
    assert.ok(METHODS[m].prompt.length > 100);
});
