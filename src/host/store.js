import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parseBook, hash, MAX_FILE, clean, plain } from "./parse.js";
import { zipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
const now = () => new Date().toISOString();
const clone = (x) => structuredClone(x);
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const anchorSchema = z.object({
  chapterId: z.string().max(100),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  quote: z.string().max(20000),
  prefix: z.string().max(120).default(""),
  suffix: z.string().max(120).default(""),
  pageOnly: z.boolean().optional(),
  rects: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0).max(1),
        height: z.number().min(0).max(1),
      }),
    )
    .max(300)
    .optional(),
});
const recordSchema = z.object({
  id: idSchema,
  bookId: idSchema,
  kind: z.enum(["highlight", "reflection", "question", "note", "ai"]),
  body: z.string().max(150000),
  anchor: anchorSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().positive(),
  deletedAt: z.string().nullable().default(null),
  origin: z.enum(["user", "ai", "edited-ai"]),
  discussionId: z.string().default(""),
  history: z
    .array(z.object({ body: z.string(), at: z.string(), revision: z.number() }))
    .default([]),
});
const exerciseSchema = z.object({
  id: idSchema,
  bookId: idSchema,
  method: z.enum(["free", "hunt", "feynman", "debate"]),
  goal: z.string().max(4000),
  stage: z.number().int().min(0).max(6),
  status: z.enum(["active", "paused", "completed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().positive(),
  templateVersion: z.literal(1),
  sessionId: z.string().default(""),
  rows: z.array(z.any()).default([]),
  contexts: z.record(z.string(), z.any()).default({}),
  receipts: z.array(z.string()).default([]),
  citations: z.array(z.string()).default([]),
});
const bookSchema = z.object({
  id: idSchema,
  title: z.string().max(500),
  author: z.string().max(500),
  format: z.enum(["epub", "pdf", "txt", "md"]),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative().max(MAX_FILE),
  originalName: z.string().max(500),
  status: z.enum(["want", "reading", "paused", "finished"]),
  tags: z.array(z.string().max(80)).max(30),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastOpenedAt: z.string().nullable(),
  revision: z.number().int().positive(),
  deletedAt: z.string().nullable(),
  chapterCount: z.number().int().nonnegative(),
  hasText: z.boolean(),
  hasCover: z.boolean().default(false),
  parserVersion: z.number(),
  progress: z.object({
    chapterId: z.string(),
    offset: z.number().nonnegative(),
    pass: z.number().int().positive(),
  }),
  passes: z.array(z.any()).default([]),
});
const settingsSchema = z.object({
  replyLanguage: z.enum(["auto", "zh", "en"]).default("auto"),
  fontSize: z.number().min(14).max(32).default(20),
  lineHeight: z.number().min(1.3).max(2.6).default(1.9),
  pageWidth: z.number().min(480).max(1000).default(680),
  model: z
    .object({ provider: z.string(), model: z.string() })
    .nullable()
    .default(null),
});
const stateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  books: z.record(z.string(), bookSchema),
  records: z.record(z.string(), recordSchema),
  exercises: z.record(z.string(), exerciseSchema),
  settings: settingsSchema,
  receipts: z.record(z.string(), z.any()).default({}),
});
const empty = () => ({
  version: 1,
  revision: 0,
  books: {},
  records: {},
  exercises: {},
  settings: settingsSchema.parse({}),
  receipts: {},
});
export async function createStore(unit, root) {
  const loaded = await unit.loadAll();
  let state = stateSchema.parse(loaded.global || empty()),
    serial = Promise.resolve(),
    closed = false;
  const documents = new Map();
  const asset = (b, suffix) => path.join(root, "books", b.hash + suffix);
  async function atomic(file, bytes) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + "." + randomUUID() + ".tmp";
    await fs.writeFile(temp, bytes, { flag: "wx" });
    await fs.rename(temp, file);
  }
  async function mutate(requestId, fn) {
    const job = serial.then(async () => {
      if (closed) throw new Error("STORE_CLOSED");
      if (!requestId || requestId.length > 200)
        throw new Error("REQUEST_ID_REQUIRED");
      if (state.receipts[requestId]) return clone(state.receipts[requestId]);
      const next = clone(state),
        result = await fn(next);
      next.revision++;
      next.receipts[requestId] = result;
      const keys = Object.keys(next.receipts);
      for (const key of keys.slice(0, Math.max(0, keys.length - 1000)))
        delete next.receipts[key];
      stateSchema.parse(next);
      await unit.setGlobal(next);
      state = next;
      return clone(result);
    });
    serial = job.catch(() => {});
    return job;
  }
  function book(id, includeDeleted = false) {
    const b = state.books[id];
    if (!b || (!includeDeleted && b.deletedAt))
      throw new Error("BOOK_NOT_FOUND");
    return clone(b);
  }
  async function document(id) {
    const b = book(id, true);
    if (documents.has(b.hash)) return clone(documents.get(b.hash));
    try {
      const d = JSON.parse(await fs.readFile(asset(b, ".json"), "utf8"));
      documents.set(b.hash, d);
      if (documents.size > 8) documents.delete(documents.keys().next().value);
      return clone(d);
    } catch (e) {
      if (e.code === "ENOENT") throw new Error("ORIGINAL_MISSING");
      throw e;
    }
  }
  const check = (row, revision) => {
    if (row.revision !== revision) throw new Error("REVISION_CONFLICT");
  };
  async function validateAnchor(bookId, input) {
    if (!input) return null;
    const a = anchorSchema.parse(input),
      doc = await document(bookId),
      c = doc.chapters.find((c) => c.id === a.chapterId);
    if (!c) throw new Error("ANCHOR_MISMATCH");
    if (
      a.pageOnly &&
      doc.format === "pdf" &&
      a.start === 0 &&
      a.end === 0 &&
      a.quote === ""
    )
      return a;
    if (a.end <= a.start || c.text.slice(a.start, a.end) !== a.quote)
      throw new Error("ANCHOR_MISMATCH");
    return {
      ...a,
      prefix: c.text.slice(Math.max(0, a.start - 80), a.start),
      suffix: c.text.slice(a.end, a.end + 80),
    };
  }
  async function importBytes(bytes, name, requestId, encoding) {
    const parsed = await parseBook(bytes, name, encoding);
    return mutate(requestId, async (next) => {
      const found = Object.values(next.books).find(
        (b) => b.hash === parsed.hash,
      );
      if (found) {
        await atomic(asset(found, ".original"), bytes);
        await atomic(asset(found, ".json"), JSON.stringify(parsed));
        documents.delete(found.hash);
        return { book: found, duplicate: true };
      }
      const b = {
        id: randomUUID(),
        title: parsed.title.slice(0, 500),
        author: (parsed.author || "").slice(0, 500),
        format: parsed.format,
        hash: parsed.hash,
        bytes: bytes.length,
        originalName: path.basename(name),
        status: "want",
        tags: [],
        createdAt: now(),
        updatedAt: now(),
        lastOpenedAt: null,
        revision: 1,
        deletedAt: null,
        chapterCount: parsed.chapters.length,
        hasText: parsed.hasText,
        hasCover: !!parsed.cover,
        parserVersion: 1,
        progress: { chapterId: "c0", offset: 0, pass: 1 },
        passes: [],
      };
      await atomic(asset(b, ".original"), bytes);
      await atomic(asset(b, ".json"), JSON.stringify(parsed));
      next.books[b.id] = b;
      return { book: b, duplicate: false };
    });
  }
  async function search(query, bookId) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return { items: [] };
    const items = [];
    for (const b of Object.values(state.books).filter(
      (b) => !b.deletedAt && (!bookId || b.id === bookId),
    )) {
      const d = await document(b.id).catch(() => null);
      if (!d) continue;
      for (const c of d.chapters) {
        const text = c.text.toLowerCase();
        let at = text.indexOf(q),
          n = 0;
        while (at >= 0 && n++ < 10 && items.length < 100) {
          items.push({
            bookId: b.id,
            bookTitle: b.title,
            chapterId: c.id,
            chapterTitle: c.title,
            start: at,
            end: at + q.length,
            quote: c.text.slice(at, at + q.length),
            snippet: c.text.slice(Math.max(0, at - 60), at + q.length + 120),
          });
          at = text.indexOf(q, at + q.length);
        }
        if (items.length >= 100) break;
      }
      if (items.length >= 100) break;
    }
    return { items, truncated: items.length >= 100 };
  }
  async function backup(includeOriginals) {
    await serial;
    const snapshot = clone(state),
      files = {
        "manifest.json": strToU8(
          JSON.stringify({
            format: "dsh-ai-reading-room",
            version: 1,
            createdAt: now(),
            includeOriginals,
            state: snapshot,
          }),
        ),
      };
    let total = files["manifest.json"].length;
    for (const b of Object.values(snapshot.books)) {
      const doc = await document(b.id).catch(() => null);
      if (doc) {
        const bytes = strToU8(JSON.stringify(doc));
        total += bytes.length;
        if (total > 192 * 1024 * 1024) throw new Error("BACKUP_SIZE_LIMIT");
        files["books/" + b.hash + ".json"] = bytes;
      }
      if (includeOriginals) {
        total += b.bytes;
        if (total > 192 * 1024 * 1024) throw new Error("BACKUP_SIZE_LIMIT");
        try {
          files["books/" + b.hash + ".original"] = new Uint8Array(
            await fs.readFile(asset(b, ".original")),
          );
        } catch {
          throw new Error("ORIGINAL_MISSING");
        }
      }
    }
    return Buffer.from(zipSync(files, { level: 6 }));
  }
  async function previewRestore(bytes) {
    const { checkedZip } = await import("./parse.js");
    const files = checkedZip(bytes);
    if (!files["manifest.json"]) throw new Error("BAD_BACKUP");
    const m = JSON.parse(strFromU8(files["manifest.json"]));
    if (m.format !== "dsh-ai-reading-room" || m.version !== 1)
      throw new Error("BACKUP_VERSION");
    const s = stateSchema.parse(m.state);
    for (const [id, b] of Object.entries(s.books)) {
      if (id !== b.id) throw new Error("BAD_BACKUP");
      const original = files["books/" + b.hash + ".original"];
      if (original && hash(original) !== b.hash) throw new Error("BACKUP_HASH");
      const raw = files["books/" + b.hash + ".json"];
      if (raw) {
        const doc = JSON.parse(strFromU8(raw));
        if (
          doc.hash !== b.hash ||
          !Array.isArray(doc.chapters) ||
          doc.chapters.length !== b.chapterCount
        )
          throw new Error("BAD_BACKUP");
        const chapterIds = new Set();
        for (const c of doc.chapters) {
          if (
            typeof c.html !== "string" ||
            typeof c.text !== "string" ||
            !/^c\d+$/.test(c.id) ||
            chapterIds.has(c.id)
          )
            throw new Error("BAD_BACKUP");
          chapterIds.add(c.id);
          const html = clean(c.html, (src) =>
            /^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(
              src || "",
            )
              ? src
              : "",
          );
          if (plain(html) !== c.text) throw new Error("BACKUP_TEXT_MISMATCH");
          c.html = html;
        }
        files["books/" + b.hash + ".json"] = strToU8(JSON.stringify(doc));
      }
    }
    for (const r of Object.values(s.records))
      if (!s.books[r.bookId]) throw new Error("BAD_BACKUP");
    for (const x of Object.values(s.exercises))
      if (!s.books[x.bookId]) throw new Error("BAD_BACKUP");
    return {
      files,
      s,
      summary: {
        books: Object.keys(s.books).length,
        records: Object.keys(s.records).length,
        exercises: Object.keys(s.exercises).length,
        includeOriginals: !!m.includeOriginals,
        conflicts: Object.values(s.books).filter((b) => state.books[b.id])
          .length,
      },
    };
  }
  async function restore(bytes, requestId, confirm) {
    if (!confirm) throw new Error("CONFIRM_REQUIRED");
    const { files, s } = await previewRestore(bytes);
    return mutate(requestId, async (next) => {
      await atomic(
        path.join(
          root,
          "backups",
          now().replace(/[:.]/g, "-") + "-before-restore.zip",
        ),
        await backupFromState(next),
      );
      for (const b of Object.values(s.books)) {
        for (const suffix of [".json", ".original"]) {
          const data = files["books/" + b.hash + suffix];
          if (data) await atomic(asset(b, suffix), data);
        }
      }
      // Restored transcripts stay portable; never resume an imported native session identity.
      for (const x of Object.values(s.exercises)) x.sessionId = "";
      Object.assign(next, {
        books: s.books,
        records: s.records,
        exercises: s.exercises,
        settings: s.settings,
        receipts: {},
      });
      documents.clear();
      return { restored: true, books: Object.keys(s.books).length };
    });
  }
  async function backupFromState(s) {
    const files = {
      "manifest.json": strToU8(
        JSON.stringify({
          format: "dsh-ai-reading-room",
          version: 1,
          createdAt: now(),
          includeOriginals: false,
          state: s,
        }),
      ),
    };
    for (const b of Object.values(s.books)) {
      try {
        files["books/" + b.hash + ".json"] = new Uint8Array(
          await fs.readFile(asset(b, ".json")),
        );
      } catch {}
    }
    return Buffer.from(zipSync(files));
  }
  async function action(a) {
    switch (a.action) {
      case "read":
        return {
          revision: state.revision,
          books: Object.values(state.books).map(clone),
          settings: clone(state.settings),
          recordCount: Object.keys(state.records).length,
          root,
        };
      case "open": {
        const b = book(a.id),
          d = await document(a.id);
        return {
          book: b,
          chapters: d.chapters.map(({ html, text, ...c }) => ({
            ...c,
            chars: text.length,
          })),
          cover: d.cover || "",
          language: d.language || "",
          records: Object.values(state.records)
            .filter((r) => r.bookId === a.id)
            .map(clone),
          exercises: Object.values(state.exercises)
            .filter((x) => x.bookId === a.id)
            .map(({ rows, contexts, ...x }) => clone(x)),
        };
      }
      case "chapter": {
        const d = await document(a.id),
          c = d.chapters.find((c) => c.id === a.chapterId);
        if (!c) throw new Error("CHAPTER_NOT_FOUND");
        return { chapter: c };
      }
      case "records":
        return {
          items: Object.values(state.records)
            .filter((r) => !a.id || r.bookId === a.id)
            .map(clone),
        };
      case "search":
        return search(a.query, a.id);
      case "saveBook":
        return mutate(a.requestId, (next) => {
          const b = next.books[a.id];
          if (!b) throw new Error("BOOK_NOT_FOUND");
          check(b, a.revision);
          for (const k of ["title", "author", "tags", "status"])
            if (a.item?.[k] !== undefined) b[k] = a.item[k];
          b.revision++;
          b.updatedAt = now();
          return { book: b };
        });
      case "progress": {
        const d = await document(a.id);
        if (!d.chapters.some((c) => c.id === a.chapterId))
          throw new Error("CHAPTER_NOT_FOUND");
        return mutate(a.requestId, (next) => {
          const b = next.books[a.id];
          b.progress = {
            ...b.progress,
            chapterId: a.chapterId,
            offset: Math.max(0, Number(a.offset) || 0),
          };
          b.lastOpenedAt = now();
          if (b.status === "want") b.status = "reading";
          return { progress: b.progress };
        });
      }
      case "newPass":
        return mutate(a.requestId, (next) => {
          const b = next.books[a.id];
          if (!b) throw new Error("BOOK_NOT_FOUND");
          check(b, a.revision);
          b.passes.push({ ...b.progress, endedAt: now() });
          b.progress = {
            chapterId: "c0",
            offset: 0,
            pass: b.progress.pass + 1,
          };
          b.status = "reading";
          b.revision++;
          return { book: b };
        });
      case "trashBook":
        return mutate(a.requestId, (next) => {
          const b = next.books[a.id];
          if (!b) throw new Error("BOOK_NOT_FOUND");
          check(b, a.revision);
          b.deletedAt = a.restore ? null : now();
          b.revision++;
          return { book: b };
        });
      case "saveRecord": {
        book(a.bookId);
        const anchor = await validateAnchor(a.bookId, a.item?.anchor);
        return mutate(a.requestId, (next) => {
          let r = a.id ? next.records[a.id] : null;
          if (a.id && !r) throw new Error("RECORD_NOT_FOUND");
          if (r) {
            if (r.bookId !== a.bookId) throw new Error("RECORD_SCOPE");
            check(r, a.revision);
            r.history.push({
              body: r.body,
              at: r.updatedAt,
              revision: r.revision,
            });
            r.body = String(a.item.body || "");
            r.updatedAt = now();
            r.revision++;
            if (r.origin === "ai") r.origin = "edited-ai";
          } else {
            r = {
              id: randomUUID(),
              bookId: a.bookId,
              kind: a.item?.kind || "reflection",
              body: String(a.item?.body || ""),
              anchor,
              origin: a.item?.origin === "ai" ? "ai" : "user",
              discussionId: a.item?.discussionId || "",
              createdAt: now(),
              updatedAt: now(),
              revision: 1,
              deletedAt: null,
              history: [],
            };
          }
          if (!r.body.trim() && !r.anchor) throw new Error("EMPTY_RECORD");
          recordSchema.parse(r);
          next.records[r.id] = r;
          return { record: r };
        });
      }
      case "trashRecord":
        return mutate(a.requestId, (next) => {
          const r = next.records[a.id];
          if (!r) throw new Error("RECORD_NOT_FOUND");
          check(r, a.revision);
          r.deletedAt = a.restore ? null : now();
          r.revision++;
          return { record: r };
        });
      case "settings":
        return mutate(a.requestId, (next) => {
          if (a.revision !== next.revision)
            throw new Error("REVISION_CONFLICT");
          next.settings = settingsSchema.parse({ ...next.settings, ...a.item });
          return { settings: next.settings };
        });
      case "createExercise": {
        book(a.bookId);
        return mutate(a.requestId, (next) => {
          const x = exerciseSchema.parse({
            id: randomUUID(),
            bookId: a.bookId,
            method: a.method || "free",
            goal: String(a.goal || ""),
            stage: 0,
            status: "active",
            createdAt: now(),
            updatedAt: now(),
            revision: 1,
            templateVersion: 1,
            sessionId: "",
            rows: [],
            contexts: {},
            receipts: [],
          });
          next.exercises[x.id] = x;
          return { exercise: x };
        });
      }
      case "exercise": {
        const x = state.exercises[a.id];
        if (!x) throw new Error("EXERCISE_NOT_FOUND");
        return { exercise: clone(x) };
      }
      case "saveExercise":
        return mutate(a.requestId, (next) => {
          const x = next.exercises[a.id];
          if (!x) throw new Error("EXERCISE_NOT_FOUND");
          check(x, a.revision);
          for (const k of ["goal", "stage", "status"])
            if (a.item?.[k] !== undefined) x[k] = a.item[k];
          x.revision++;
          x.updatedAt = now();
          exerciseSchema.parse(x);
          return { exercise: x };
        });
      case "export": {
        const b = book(a.id, true);
        const records = Object.values(state.records).filter(
          (r) => r.bookId === b.id && !r.deletedAt,
        );
        const text = [
          "---",
          "title: " + JSON.stringify(b.title),
          "author: " + JSON.stringify(b.author),
          "fileHash: " + b.hash,
          "exportedAt: " + now(),
          "---",
          "",
          "# " + b.title,
          ...records.flatMap((r) => [
            "",
            "## " + r.kind + " · " + r.createdAt,
            "",
            ...(r.anchor
              ? [
                  "> " + r.anchor.quote.replace(/\n/g, "\n> "),
                  "",
                  "Source: " + r.anchor.chapterId + " @ " + r.anchor.start,
                  "",
                ]
              : []),
            r.body,
            "",
            "Origin: " + r.origin,
          ]),
          "",
          ...Object.values(state.exercises)
            .filter((x) => x.bookId === b.id)
            .flatMap((x) => [
              "## " + x.method + " · " + x.goal,
              ...x.rows.map(
                (r) => "\n### " + r.role + " · " + r.time + "\n\n" + r.text,
              ),
            ]),
        ].join("\n");
        return { text, name: b.title + ".md" };
      }
      default:
        throw new Error("UNKNOWN_ACTION");
    }
  }
  async function writeExercise(id, fn) {
    return mutate(randomUUID(), (next) => {
      const x = next.exercises[id];
      if (!x) throw new Error("EXERCISE_NOT_FOUND");
      fn(x);
      x.updatedAt = now();
      return { exercise: x };
    });
  }
  return {
    action,
    book,
    document,
    validateAnchor,
    importBytes,
    search,
    backup,
    previewRestore,
    restore,
    writeExercise,
    exercise: (id) => clone(state.exercises[id]),
    settings: () => clone(state.settings),
    asset,
    close: async () => {
      await serial;
      closed = true;
      await unit.close();
    },
  };
}
