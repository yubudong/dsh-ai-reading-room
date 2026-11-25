import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createStore } from "../src/host/store.js";
import {
  textLocation,
  resolveTextLocation,
  pdfLocation,
  locationScroll,
} from "../src/shared/reading-position.js";
import {
  rememberRead,
  verifyQuoteReference,
  referencesInMessage,
} from "../src/shared/citations.js";
import {
  filterLearningRecords,
  exportLearningRecords,
  recordDay,
} from "../src/shared/learning-records.js";
import {
  collectReviewSource,
  initialReviewDraft,
  REVIEW_PROMPT,
} from "../src/shared/reading-review.js";
const req = () => randomUUID();
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arr-assets-"));
  let global;
  const unit = {
    loadAll: async () => ({ global: structuredClone(global), tables: {} }),
    setGlobal: async (s) => {
      global = structuredClone(s);
    },
    close: async () => {},
  };
  let store = await createStore(unit, root);
  t.after(async () => {
    await store.close();
    const real = await fs.realpath(root);
    assert.ok(
      real.startsWith((await fs.realpath(os.tmpdir())) + path.sep) &&
        path.basename(real).startsWith("arr-assets-"),
    );
    await fs.rm(real, { recursive: true });
  });
  const book = (
    await store.importBytes(
      Buffer.from(
        "A meaningful concept has examples and limits.\nWe can test an explanation.",
      ),
      "sample.txt",
      req(),
    )
  ).book;
  return {
    get store() {
      return store;
    },
    book,
    reopen: async () => {
      await store.close();
      store = await createStore(unit, root);
    },
  };
}
test("text positions restore the same words after insertion and distinguish repeated quotations by context", () => {
  const source =
    "Before. " + "a".repeat(120) + " Target sentence. " + "b".repeat(160);
  const at = source.indexOf("Target");
  const loc = textLocation("c0", source, at, -4);
  assert.equal(resolveTextLocation(source, loc), at);
  assert.equal(
    resolveTextLocation("New introduction. " + source, loc),
    at + 18,
  );
  assert.equal(resolveTextLocation("unrelated", loc), null);
  const repeated =
    "prefix1 " +
    "x".repeat(100) +
    " suffix1 prefix2 " +
    "x".repeat(100) +
    " suffix2";
  const second = repeated.lastIndexOf("x".repeat(100));
  const p = textLocation("c0", repeated, second);
  assert.equal(resolveTextLocation("inserted " + repeated, p), second + 9);
});
test("PDF scroll fractions keep relative position across viewport and zoom changes", () => {
  const p = pdfLocation("c4", 300, 1200, 600, 100, 1000, 600);
  assert.equal(p.fraction, 0.5);
  assert.equal(locationScroll(p, 2200, 800), 700);
  assert.equal(p.xFraction, 0.25);
  assert.equal(locationScroll(pdfLocation("c0", 0, 200, 600), 200, 600), 0);
});
test("verified references are limited to text actually returned by reading tools and old message references stay stable", () => {
  const x = {},
    text = "Opening. A precise sentence. Closing.";
  const ref = rememberRead(x, "c0", text, 9, 28);
  assert.equal(ref.anchor.start, 9);
  assert.throws(
    () => verifyQuoteReference(x, "c0", text, { quote: "Opening." }),
    /CITATION_NOT_READ/,
  );
  const exact = verifyQuoteReference(x, "c0", text, {
    quote: "A precise sentence.",
  });
  x.citationRefs[exact.key] = exact.anchor;
  const old = referencesInMessage("See [" + exact.key + "]", x.citationRefs);
  rememberRead(x, "c0", text, 29, text.length);
  assert.equal(old[exact.key].quote, "A precise sentence.");
  assert.deepEqual(
    referencesInMessage("invented [c99:1-20]", x.citationRefs),
    {},
  );
});
test("record filtering combines book, annotation, date, unresolved and unwritten criteria in the reader time zone", () => {
  const base = {
    bookId: "b1",
    deletedAt: null,
    createdAt: "2026-11-24T17:00:00Z",
    origin: "user",
    anchor: { chapterId: "c0", start: 0, end: 1, quote: "A" },
  };
  const rows = [
    {
      ...base,
      id: "a",
      kind: "highlight",
      body: "",
      annotation: { style: "highlight", color: "blue" },
    },
    {
      ...base,
      id: "b",
      kind: "question",
      body: "Why?",
      questionState: "open",
      annotation: { style: "underline", color: "yellow" },
    },
    {
      ...base,
      id: "c",
      kind: "question",
      body: "Resolved",
      questionState: "understood",
    },
    { ...base, id: "d", bookId: "b2", kind: "note", body: "Other" },
  ];
  assert.equal(recordDay(base.createdAt, "Asia/Singapore"), "2026-11-25");
  assert.deepEqual(
    filterLearningRecords(rows, {
      color: "blue",
      onlyUnwritten: true,
      from: "2026-11-25",
      to: "2026-11-25",
      zone: "Asia/Singapore",
    }).map((x) => x.id),
    ["a"],
  );
  assert.deepEqual(
    filterLearningRecords(rows, { onlyOpenQuestions: true, bookId: "b1" }).map(
      (x) => x.id,
    ),
    ["b"],
  );
  assert.equal(filterLearningRecords(rows, { query: "WHY" }).length, 1);
  assert.equal(filterLearningRecords(rows, { color: "yellow" }).length, 0);
  assert.ok(
    exportLearningRecords(
      [rows[1]],
      [{ id: "b1", title: "Book one" }],
    ).includes("Question state: open") ||
      exportLearningRecords(
        [rows[1]],
        [{ id: "b1", title: "Book one" }],
      ).includes("疑问状态: open"),
  );
});
test("position anchors, question status, reply preference and selected export survive persistence", async (t) => {
  const f = await setup(t),
    doc = await f.store.document(f.book.id),
    loc = textLocation("c0", doc.chapters[0].text, 13, -3);
  await f.store.action({
    action: "progress",
    id: f.book.id,
    chapterId: "c0",
    offset: 125,
    item: { location: loc },
    requestId: req(),
  });
  const r = (
    await f.store.action({
      action: "saveRecord",
      bookId: f.book.id,
      item: {
        kind: "question",
        body: "Can I explain the boundary?",
        anchor: { chapterId: "c0", start: 0, end: 1, quote: "A" },
      },
      requestId: req(),
    })
  ).record;
  const changed = (
    await f.store.action({
      action: "questionState",
      id: r.id,
      revision: r.revision,
      item: { state: "understood" },
      requestId: req(),
    })
  ).record;
  assert.equal(changed.body, r.body);
  await f.store.action({
    action: "replyLength",
    item: { length: "short" },
    requestId: req(),
  });
  await f.reopen();
  const opened = await f.store.action({ action: "open", id: f.book.id });
  assert.deepEqual(opened.book.progress.location, loc);
  assert.equal(opened.records[0].questionState, "understood");
  assert.equal(f.store.settings().replyLength, "short");
  const exported = await f.store.action({
    action: "exportRecords",
    item: { ids: [r.id] },
    language: "en",
  });
  assert.ok(exported.text.includes("Question state: understood"));
  await assert.rejects(
    () =>
      f.store.action({
        action: "progress",
        id: f.book.id,
        chapterId: "c0",
        offset: 20,
        item: { location: { ...loc, quote: "forged" } },
        requestId: req(),
      }),
    /ANCHOR_MISMATCH/,
  );
});
test("review sources separate reader words, AI suggestions and notes and do not treat questions as mastery", () => {
  const book = { id: "b", title: "Book" },
    since = "2026-11-25T01:00:00Z",
    until = "2026-11-25T02:00:00Z";
  const source = collectReviewSource({
    book,
    chapter: { id: "c0", title: "Concepts", text: "Original words" },
    since,
    until,
    exercise: {
      id: "x",
      rows: [
        {
          id: "u",
          role: "user",
          text: "What does this mean?",
          time: "2026-11-25T01:20:00Z",
        },
        {
          id: "a",
          role: "assistant",
          text: "You understand it perfectly.",
          time: "2026-11-25T01:21:00Z",
        },
        {
          id: "old",
          role: "user",
          text: "Older idea",
          time: "2026-11-24T01:00:00Z",
        },
      ],
    },
    records: [
      {
        id: "n",
        bookId: "b",
        kind: "note",
        body: "My reflection",
        origin: "user",
        createdAt: "2026-11-25T01:30:00Z",
      },
      {
        id: "ai",
        bookId: "b",
        kind: "ai",
        body: "AI claim",
        origin: "ai",
        createdAt: "2026-11-25T01:31:00Z",
      },
      {
        id: "other",
        bookId: "other",
        kind: "note",
        body: "Private other book",
        origin: "user",
        createdAt: "2026-11-25T01:32:00Z",
      },
    ],
  });
  assert.equal(source.readerStatements.length, 1);
  assert.equal(source.assistantSuggestions.length, 1);
  assert.equal(source.savedRecords.length, 2);
  const draft = initialReviewDraft(source);
  assert.ok(draft.includes("My reflection"));
  assert.ok(!draft.includes("AI claim"));
  assert.ok(!draft.includes("Private other book"));
  assert.match(REVIEW_PROMPT, /不能把用户的问题/);
  assert.match(draft, /不自动创建待办或提醒/);
});
test("review metadata and mixed AI origin are retained in full backups without altering original notes", async (t) => {
  const f = await setup(t);
  const x = (
    await f.store.action({
      action: "createExercise",
      bookId: f.book.id,
      method: "free",
      requestId: req(),
    })
  ).exercise;
  await f.store.writeExercise(x.id, (next) => {
    next.rows = [
      {
        id: "u1",
        role: "user",
        text: "I can state the boundary.",
        time: "2026-11-25T01:10:00Z",
      },
      {
        id: "a1",
        role: "assistant",
        text: "Try an example.",
        time: "2026-11-25T01:11:00Z",
      },
    ];
  });
  const preview = await f.store.action({
    action: "reviewPreview",
    bookId: f.book.id,
    chapterId: "c0",
    discussionId: x.id,
    since: "2026-11-25T01:00:00Z",
    until: "2026-11-25T02:00:00Z",
  });
  assert.ok(preview.draft.includes("I can state the boundary."));
  const record = (
    await f.store.action({
      action: "saveRecord",
      bookId: f.book.id,
      item: {
        kind: "review",
        body: preview.draft + "\nAI suggestion, reviewed.",
        origin: "edited-ai",
        discussionId: x.id,
        reviewMeta: {
          since: preview.source.since,
          until: preview.source.until,
          chapterId: "c0",
          discussionId: x.id,
          recordIds: [],
          readerMessageIds: ["u1"],
          assistantMessageIds: ["a1"],
          containsAiSuggestion: true,
        },
      },
      requestId: req(),
    })
  ).record;
  assert.equal(record.origin, "edited-ai");
  const backup = await f.store.backup(true);
  await f.store.restore(backup, req(), true);
  const saved = (await f.store.action({ action: "records" })).items.find(
    (r) => r.id === record.id,
  );
  assert.equal(saved.reviewMeta.containsAiSuggestion, true);
  assert.equal(saved.kind, "review");
});
