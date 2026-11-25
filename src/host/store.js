import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parseBook, hash, MAX_FILE, clean, plain } from "./parse.js";
import { zipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
import {
  fileName,
  realDirectory,
  scanDirectory,
  copyVerified,
} from "./library-files.js";
import {
  methodList,
  BUILTIN_METHODS,
  localMethod,
  findMethod,
  compileMethod,
} from "../shared/method-library.js";
import { exactAnnotation } from "../shared/annotations.js";
import { resolveTextLocation } from "../shared/reading-position.js";
import { exportLearningRecords } from "../shared/learning-records.js";
import {
  collectReviewSource,
  initialReviewDraft,
} from "../shared/reading-review.js";
import {
  annotationState,
  sameAnnotationState,
  annotationHistoryStatus,
  applyAnnotationState,
  rememberAnnotationAction,
  replayAnnotationAction,
} from "../shared/annotation-history.js";
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
const annotationSchema = z.object({
  style: z.enum(["highlight", "underline", "none"]),
  color: z.enum(["yellow", "green", "blue", "pink", "purple"]),
});
const locationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    chapterId: z.string(),
    textOffset: z.number().int().nonnegative(),
    quote: z.string().max(100),
    prefix: z.string().max(40),
    suffix: z.string().max(40),
    delta: z.number().min(-200).max(200),
  }),
  z.object({
    mode: z.literal("pdf"),
    chapterId: z.string(),
    fraction: z.number().min(0).max(1),
    xFraction: z.number().min(0).max(1).default(0),
  }),
]);
const reviewMetaSchema = z.object({
  since: z.string(),
  until: z.string(),
  chapterId: z.string(),
  discussionId: z.string().default(""),
  recordIds: z.array(z.string()).max(100),
  readerMessageIds: z.array(z.string()).max(100),
  assistantMessageIds: z.array(z.string()).max(100),
  containsAiSuggestion: z.boolean(),
  requestId: z.string().max(200).default(""),
});
const recordSchema = z.object({
  id: idSchema,
  bookId: idSchema,
  kind: z.enum(["highlight", "reflection", "question", "note", "ai", "review"]),
  questionState: z.enum(["open", "understood"]).default("open"),
  reviewMeta: reviewMetaSchema.nullable().default(null),
  body: z.string().max(150000),
  anchor: anchorSchema.nullable(),
  annotation: annotationSchema.nullable().default(null),
  annotationRevision: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().positive(),
  deletedAt: z.string().nullable().default(null),
  origin: z.enum(["user", "ai", "edited-ai"]),
  discussionId: z.string().default(""),
  history: z
    .array(
      z.object({
        body: z.string(),
        at: z.string(),
        revision: z.number(),
        annotation: annotationSchema.nullable().optional(),
        visualOnly: z.boolean().optional(),
        kind: z
          .enum(["highlight", "reflection", "question", "note", "ai", "review"])
          .optional(),
        questionState: z.enum(["open", "understood"]).optional(),
      }),
    )
    .default([]),
});
const exerciseSchema = z.object({
  id: idSchema,
  bookId: idSchema,
  method: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  goal: z.string().max(4000),
  title: z.string().max(160).default(""),
  stage: z.number().int().min(0).max(6),
  status: z.enum(["active", "paused", "completed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().positive(),
  templateVersion: z.number().int().min(1).max(3),
  model: z
    .object({ provider: z.string().min(1), model: z.string().min(1) })
    .nullable()
    .default(null),
  methodHistory: z
    .array(
      z.object({
        method: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        at: z.string(),
      }),
    )
    .default([]),
  sessionId: z.string().default(""),
  rows: z.array(z.any()).default([]),
  contexts: z.record(z.string(), z.any()).default({}),
  receipts: z.array(z.string()).default([]),
  citations: z.array(z.string()).default([]),
  citationRefs: z.record(z.string(), anchorSchema).default({}),
  readRanges: z
    .record(
      z.string(),
      z.array(
        z.tuple([
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
        ]),
      ),
    )
    .default({}),
  replyReferences: z
    .record(z.string(), z.record(z.string(), anchorSchema))
    .default({}),
});
const bookSchema = z.object({
  id: idSchema,
  title: z.string().max(500),
  author: z.string().max(500),
  format: z.enum(["epub", "pdf", "txt", "md"]),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative().max(MAX_FILE),
  originalName: z.string().max(500),
  storage: z.enum(["managed", "linked"]).default("managed"),
  sourcePath: z.string().default(""),
  managedName: z
    .string()
    .refine(
      (x) =>
        !x ||
        (!x.includes("/") && !x.includes("\\") && x !== "." && x !== ".."),
    )
    .default(""),
  directoryId: z.string().default(""),
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
    location: locationSchema.nullable().default(null),
  }),
  passes: z.array(z.any()).default([]),
});
const settingsSchema = z.object({
  replyLanguage: z.enum(["auto", "zh", "en"]).default("auto"),
  replyLength: z.enum(["short", "balanced", "deep"]).default("balanced"),
  fontSize: z.number().min(14).max(32).default(20),
  lineHeight: z.number().min(1.3).max(2.6).default(1.9),
  pageWidth: z.number().min(480).max(1000).default(680),
  model: z
    .object({ provider: z.string(), model: z.string() })
    .nullable()
    .default(null),
});
const personalMethodSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  scenario: z.string().max(4000).default(""),
  usage: z.string().max(6000).default(""),
  prompt: z.string().min(1).max(30000),
  builtin: z.literal(false),
  enabled: z.boolean(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  history: z
    .array(
      z.object({ prompt: z.string(), revision: z.number(), at: z.string() }),
    )
    .default([]),
});
const annotationVisualSchema = z.object({
  annotation: annotationSchema.nullable(),
  deleted: z.boolean(),
  generation: z.number().int().nonnegative().default(0),
});
const annotationStepSchema = z.object({
  id: z
    .string()
    .max(200)
    .default(() => randomUUID()),
  recordId: idSchema,
  label: z.enum(["markCreate", "markStyle", "markRemove"]),
  before: annotationVisualSchema,
  after: annotationVisualSchema,
});
const stateSchema = z.object({
  annotationHistory: z
    .record(
      z.string(),
      z.object({
        undo: z.array(annotationStepSchema).max(50),
        redo: z.array(annotationStepSchema).max(50),
      }),
    )
    .default({}),
  version: z.literal(1),
  uxVersion: z.number().default(0),
  revision: z.number().int().nonnegative(),
  books: z.record(z.string(), bookSchema),
  records: z.record(z.string(), recordSchema),
  exercises: z.record(z.string(), exerciseSchema),
  settings: settingsSchema,
  receipts: z.record(z.string(), z.any()).default({}),
  libraryPath: z.string().default(""),
  directories: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        path: z.string(),
        recursive: z.boolean(),
        checkOnOpen: z.boolean().default(false),
        excludedPaths: z.array(z.string()).default([]),
        lastScan: z.string().nullable().default(null),
      }),
    )
    .default({}),
  methods: z.record(z.string(), personalMethodSchema).default({}),
  builtinOverrides: z
    .record(
      z.string(),
      personalMethodSchema.extend({ builtin: z.literal(true) }),
    )
    .default({}),
  builtinVersions: z
    .record(z.string(), z.number().int().positive())
    .default({}),
  methodArchives: z
    .record(
      z.string(),
      z.array(
        z.object({ prompt: z.string(), revision: z.number(), at: z.string() }),
      ),
    )
    .default({}),
  methodOrder: z.array(z.string()).default([]),
  preferences: z
    .object({
      onboarded: z.boolean().default(false),
      tips: z.enum(["all", "necessary", "off"]).default("all"),
      promptDisplay: z.enum(["full", "compact", "hidden"]).default("compact"),
      annotationLabels: z
        .record(z.string(), z.string().trim().max(40))
        .default({}),
      methodFavorites: z.array(idSchema).default([]),
      methodIntro: z
        .record(
          z.string(),
          z.object({
            skip: z.boolean(),
            seenRevision: z.number().int().nonnegative(),
          }),
        )
        .default({}),
    })
    .default({
      onboarded: false,
      tips: "all",
      promptDisplay: "compact",
      methodIntro: {},
    }),
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
  const asset = (b, suffix) =>
    suffix === ".original"
      ? b.storage === "linked"
        ? b.sourcePath
        : b.managedName
          ? path.join(
              state.libraryPath || path.join(root, "library"),
              b.managedName,
            )
          : path.join(root, "books", b.hash + ".original")
      : path.join(root, "books", b.hash + suffix);
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
      let d = JSON.parse(await fs.readFile(asset(b, ".json"), "utf8"));
      if (b.format === "epub" && d.navigationVersion !== 2) {
        try {
          const bytes = await fs.readFile(asset(b, ".original"));
          const parsed = await parseBook(bytes, b.originalName);
          if (
            parsed.chapters.length === d.chapters.length &&
            parsed.chapters.every((c, i) => c.text === d.chapters[i].text)
          ) {
            d = {
              ...d,
              toc: parsed.toc,
              navigationVersion: 2,
              chapters: d.chapters.map((c, i) => ({
                ...c,
                title: parsed.chapters[i].title,
                sourceHref: parsed.chapters[i].sourceHref,
              })),
            };
            await atomic(asset(b, ".json"), JSON.stringify(d));
          } else d.navigationWarning = "NAVIGATION_TEXT_CHANGED";
        } catch (e) {
          d.navigationWarning = e.code || e.message;
        }
      }
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
  async function importBytes(bytes, name, requestId, encoding, options = {}) {
    const parsed = await parseBook(bytes, name, encoding);
    return mutate(requestId, async (next) => {
      const found = Object.values(next.books).find(
        (b) => b.hash === parsed.hash,
      );
      if (found) {
        if (found.deletedAt) {
          found.deletedAt = null;
          found.revision++;
          found.updatedAt = now();
        }
        if (found.storage === "linked" && options.sourcePath) {
          found.sourcePath = options.sourcePath;
          found.directoryId = options.directoryId || found.directoryId;
        }
        if (found.storage !== "linked")
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
        storage: options.link ? "linked" : "managed",
        sourcePath: options.link ? options.sourcePath : "",
        directoryId: options.directoryId || "",
        managedName: options.link
          ? ""
          : fileName({ hash: parsed.hash, originalName: name }),
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
      if (!options.link) await atomic(asset(b, ".original"), bytes);
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
            version: 2,
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
          const original = await fs.readFile(asset(b, ".original"));
          if (hash(original) !== b.hash)
            throw new Error("ORIGINAL_HASH_MISMATCH");
          files["books/" + b.hash + ".original"] = new Uint8Array(original);
        } catch (e) {
          if (e.message === "ORIGINAL_HASH_MISMATCH") throw e;
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
    if (m.format !== "dsh-ai-reading-room" || ![1, 2].includes(m.version))
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
      if (x.bookId !== "__help__" && !s.books[x.bookId])
        throw new Error("BAD_BACKUP");
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
        const previous = state.books[b.id];
        if (files["books/" + b.hash + ".original"]) {
          b.storage = "managed";
          b.managedName = fileName(b);
          b.sourcePath = "";
          b.directoryId = "";
        } else if (previous?.hash === b.hash) {
          b.storage = previous.storage;
          b.managedName = previous.managedName;
          b.sourcePath = previous.sourcePath;
          b.directoryId = previous.directoryId;
        } else {
          b.storage = "managed";
          b.managedName = fileName(b);
          b.sourcePath = "";
          b.directoryId = "";
        }
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
        methods: s.methods,
        builtinOverrides: s.builtinOverrides,
        builtinVersions: s.builtinVersions,
        methodArchives: s.methodArchives,
        methodOrder: s.methodOrder,
        preferences: s.preferences,
        receipts: {},
        annotationHistory: {},
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
          version: 2,
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
  function methods() {
    return methodList(
      state.methods,
      state.builtinOverrides,
      state.builtinVersions,
    )
      .map((m) => ({
        ...m,
        history: m.history || state.methodArchives[m.id] || [],
      }))
      .map(clone)
      .sort((a, b) => {
        const x = state.methodOrder.indexOf(a.id),
          y = state.methodOrder.indexOf(b.id);
        return (x < 0 ? 9999 : x) - (y < 0 ? 9999 : y);
      });
  }
  function resolveMethod(id) {
    const m = methods().find((m) => m.id === id);
    if (!m) throw new Error("METHOD_NOT_FOUND");
    return m;
  }
  async function methodPreview(a) {
    const b = book(a.bookId || a.id),
      doc = await document(b.id),
      anchor = await validateAnchor(b.id, a.anchor),
      chapter = doc.chapters.find(
        (c) => c.id === (anchor?.chapterId || a.chapterId),
      );
    const method = resolveMethod(a.method || "free");
    if (!method.enabled) throw new Error("METHOD_DISABLED");
    let notes = "";
    if (a.includeNotes)
      notes = Object.values(state.records)
        .filter((r) => r.bookId === b.id && !r.deletedAt)
        .map((r) => r.body)
        .join("\n")
        .slice(0, 12000);
    if (a.override !== undefined) z.string().max(30000).parse(a.override);
    const snapshot = compileMethod({
      method,
      language: a.language === "en" ? "en" : "zh",
      book: b,
      chapter,
      anchor,
      notes,
      override: a.override,
    });
    if (snapshot.prompt.length > 60000) throw new Error("PROMPT_TOO_LONG");
    return {
      ...snapshot,
      hash: hash(Buffer.from(snapshot.prompt)),
      source: {
        bookId: b.id,
        chapterId: chapter?.id || "",
        selected: anchor,
        includeNotes: !!a.includeNotes,
      },
    };
  }
  function exercise(id) {
    const x = state.exercises[id];
    if (!x) throw new Error("EXERCISE_NOT_FOUND");
    return clone(x);
  }
  async function reviewContext(a) {
    const b = book(a.bookId),
      doc = await document(b.id),
      x = a.discussionId ? exercise(a.discussionId) : null;
    if (x && x.bookId !== b.id) throw new Error("RECORD_SCOPE");
    if (a.location) {
      const loc = locationSchema.parse(a.location);
      if (loc.chapterId !== a.chapterId) throw new Error("ANCHOR_MISMATCH");
    }
    const c = doc.chapters.find((c) => c.id === a.chapterId);
    if (a.chapterId && !c) throw new Error("CHAPTER_NOT_FOUND");
    return collectReviewSource({
      book: b,
      chapter: c,
      exercise: x,
      records: Object.values(state.records),
      since: a.since,
      until: a.until || now(),
      readingOffset: a.location?.textOffset || 0,
    });
  }
  async function action(a) {
    switch (a.action) {
      case "annotationState": {
        book(a.bookId);
        return {
          ...(a.item?.summaryOnly
            ? {}
            : {
                items: Object.values(state.records)
                  .filter((r) => r.bookId === a.bookId)
                  .map(clone),
              }),
          history: annotationHistoryStatus(
            state.annotationHistory[a.bookId],
            state.records,
            a.bookId,
          ),
        };
      }
      case "annotationAction": {
        book(a.bookId);
        const operation = z
            .enum(["style", "remove"])
            .parse(a.item?.operation || "style"),
          anchor = !a.id
            ? await validateAnchor(a.bookId, a.item?.anchor)
            : null;
        return mutate(a.requestId, (next) => {
          if (!next.books[a.bookId] || next.books[a.bookId].deletedAt)
            throw new Error("BOOK_NOT_FOUND");
          let r = a.id
            ? next.records[a.id]
            : anchor
              ? exactAnnotation(
                  Object.values(next.records).filter(
                    (r) => r.bookId === a.bookId,
                  ),
                  anchor,
                )
              : null;
          if (a.id && (!r || r.deletedAt)) throw new Error("RECORD_NOT_FOUND");
          if (r?.bookId && r.bookId !== a.bookId)
            throw new Error("RECORD_SCOPE");
          if (r && a.id) check(r, a.revision);
          const ledger = (next.annotationHistory[a.bookId] ??= {
            undo: [],
            redo: [],
          });
          let before, label;
          if (!r) {
            if (operation !== "style" || !anchor || anchor.pageOnly)
              throw new Error("ANCHOR_MISMATCH");
            r = recordSchema.parse({
              id: randomUUID(),
              bookId: a.bookId,
              kind: "highlight",
              body: "",
              anchor,
              annotation: annotationSchema.parse(a.item.annotation),
              createdAt: now(),
              updatedAt: now(),
              revision: 1,
              deletedAt: null,
              origin: "user",
              history: [],
            });
            r.annotationRevision = 1;
            before = { annotation: null, deleted: true, generation: 0 };
            label = "markCreate";
            next.records[r.id] = r;
          } else {
            if (!r.anchor || r.anchor.pageOnly)
              throw new Error("ANCHOR_MISMATCH");
            before = annotationState(r);
            const desired =
              operation === "style"
                ? {
                    annotation: annotationSchema.parse(a.item.annotation),
                    deleted: false,
                  }
                : r.body.trim() || r.kind !== "highlight"
                  ? {
                      annotation: {
                        style: "none",
                        color: r.annotation?.color || "yellow",
                      },
                      deleted: false,
                    }
                  : { annotation: r.annotation, deleted: true };
            if (sameAnnotationState(r, desired, false))
              return {
                changed: false,
                recordId: r.id,
                revision: r.revision,
                history: annotationHistoryStatus(
                  ledger,
                  next.records,
                  a.bookId,
                ),
              };
            applyAnnotationState(r, desired, now());
            label = operation === "style" ? "markStyle" : "markRemove";
          }
          rememberAnnotationAction(ledger, {
            id: a.requestId,
            recordId: r.id,
            label,
            before,
            after: annotationState(r),
          });
          return {
            changed: true,
            recordId: r.id,
            revision: r.revision,
            history: annotationHistoryStatus(ledger, next.records, a.bookId),
          };
        });
      }
      case "annotationReplay": {
        book(a.bookId);
        const direction = z.enum(["undo", "redo"]).parse(a.item?.direction);
        return mutate(a.requestId, (next) => {
          const ledger = (next.annotationHistory[a.bookId] ??= {
            undo: [],
            redo: [],
          });
          const r = replayAnnotationAction(
            ledger,
            next.records,
            a.bookId,
            direction,
            now(),
            a.item?.expectedId,
          );
          return {
            recordId: r.id,
            revision: r.revision,
            history: annotationHistoryStatus(ledger, next.records, a.bookId),
          };
        });
      }

      case "replyLength":
        return mutate(a.requestId, (next) => {
          next.settings.replyLength = z
            .enum(["short", "balanced", "deep"])
            .parse(a.item?.length);
          return { length: next.settings.replyLength };
        });
      case "reviewPreview": {
        const source = await reviewContext(a);
        return { source, draft: initialReviewDraft(source, a.language) };
      }
      case "exportRecords": {
        const ids = z.array(idSchema).min(1).max(1000).parse(a.item?.ids);
        const rows = ids.map((id) => state.records[id]);
        if (rows.some((r) => !r || r.deletedAt))
          throw new Error("RECORD_NOT_FOUND");
        return {
          text: exportLearningRecords(
            rows,
            Object.values(state.books),
            a.language,
          ),
          name: "reading-records-" + now().slice(0, 10) + ".md",
        };
      }
      case "questionState":
        return mutate(a.requestId, (next) => {
          const r = next.records[a.id];
          if (!r || r.deletedAt || r.kind !== "question")
            throw new Error("RECORD_NOT_FOUND");
          check(r, a.revision);
          r.history.push({
            body: r.body,
            annotation: r.annotation,
            at: r.updatedAt,
            revision: r.revision,
          });
          r.questionState = z.enum(["open", "understood"]).parse(a.item?.state);
          r.revision++;
          r.updatedAt = now();
          return { record: r };
        });
      case "methods":
        return {
          items: methods(),
          methodIntro: clone(state.preferences.methodIntro || {}),
          replyLength: state.settings.replyLength,
          favorites: clone(state.preferences.methodFavorites || []),
        };
      case "exerciseList":
        return {
          items: Object.values(state.exercises)
            .filter((x) => x.bookId === a.bookId)
            .map(({ rows, contexts, ...x }) => clone(x)),
        };
      case "methodPreview":
        return methodPreview(a);
      case "moveMethod":
        return mutate(a.requestId, (next) => {
          const ids = methods().map((m) => m.id),
            index = ids.indexOf(a.id);
          if (index < 0) throw new Error("METHOD_NOT_FOUND");
          const target = Math.max(
            0,
            Math.min(ids.length - 1, index + (a.item?.direction < 0 ? -1 : 1)),
          );
          [ids[index], ids[target]] = [ids[target], ids[index]];
          next.methodOrder = ids;
          return { order: ids };
        });
      case "methodIntro":
        return mutate(a.requestId, (next) => {
          const m = resolveMethod(a.id);
          next.preferences.methodIntro = {
            ...(next.preferences.methodIntro || {}),
            [a.id]: { skip: !!a.item?.skip, seenRevision: m.revision },
          };
          return { preferences: next.preferences };
        });
      case "resetMethod":
        return mutate(a.requestId, (next) => {
          const current = resolveMethod(a.id);
          if (!current.builtin) throw new Error("METHOD_NOT_FOUND");
          check(current, a.revision);
          next.methodArchives[a.id] = [
            ...(current.history || []),
            {
              prompt: localMethod(current.prompt, a.language || "zh"),
              revision: current.revision,
              at: now(),
            },
          ];
          delete next.builtinOverrides[a.id];
          next.builtinVersions[a.id] = current.revision + 1;
          return { reset: true };
        });
      case "saveMethod":
        return mutate(a.requestId, (next) => {
          const base = a.id ? resolveMethod(a.id) : null;
          if (base) check(base, a.revision);
          const item = a.item || {},
            name = z.string().trim().min(1).max(100).parse(item.name),
            prompt = z.string().min(1).max(30000).parse(item.prompt);
          const m = {
            id: base?.id || "custom_" + randomUUID(),
            name,
            description: String(item.description || "").slice(0, 1000),
            scenario: String(
              item.scenario ?? localMethod(base?.scenario, a.language || "zh"),
            ).slice(0, 4000),
            usage: String(
              item.usage ?? localMethod(base?.usage, a.language || "zh"),
            ).slice(0, 6000),
            prompt,
            revision: (base?.revision || 0) + 1,
            builtin: !!base?.builtin,
            enabled: item.enabled !== false,
            createdAt: base?.createdAt || now(),
            updatedAt: now(),
            history: [
              ...(base?.history || []),
              ...(base
                ? [
                    {
                      prompt: localMethod(base.prompt, a.language || "zh"),
                      revision: base.revision,
                      at: base.updatedAt || now(),
                    },
                  ]
                : []),
            ],
          };
          if (m.builtin) {
            next.builtinOverrides[m.id] = m;
            next.builtinVersions[m.id] = m.revision;
          } else next.methods[m.id] = m;
          return { method: m };
        });
      case "removeMethod":
        return mutate(a.requestId, (next) => {
          const m = next.methods[a.id];
          if (!m) throw new Error("METHOD_NOT_FOUND");
          check(m, a.revision);
          m.enabled = false;
          m.revision++;
          m.updatedAt = now();
          return { method: m };
        });
      case "exportMethods":
        return {
          format: "ai-reading-room-methods",
          version: 1,
          methods: [
            ...Object.values(state.methods),
            ...Object.values(state.builtinOverrides),
          ].map(clone),
        };
      case "importMethods":
        return mutate(a.requestId, (next) => {
          if (
            a.item?.format !== "ai-reading-room-methods" ||
            a.item?.version !== 1 ||
            !Array.isArray(a.item.methods) ||
            a.item.methods.length > 100
          )
            throw new Error("METHOD_IMPORT_INVALID");
          const imported = [];
          for (const raw of a.item.methods) {
            const name = z.string().trim().min(1).max(100).parse(raw.name),
              prompt = z.string().min(1).max(30000).parse(raw.prompt),
              id = "custom_" + randomUUID();
            next.methods[id] = {
              id,
              name,
              prompt,
              description: String(raw.description || "").slice(0, 1000),
              scenario: String(raw.scenario || "").slice(0, 4000),
              usage: String(raw.usage || "").slice(0, 6000),
              builtin: false,
              enabled: true,
              revision: 1,
              createdAt: now(),
              updatedAt: now(),
              history: [],
            };
            imported.push(id);
          }
          return { imported };
        });
      case "preferences":
        return mutate(a.requestId, (next) => {
          next.preferences = { ...next.preferences, ...a.item };
          return { preferences: next.preferences };
        });
      case "repairNavigation": {
        const b = book(a.id);
        documents.delete(b.hash);
        const doc = await document(b.id);
        return {
          toc: doc.toc || [],
          warning: doc.navigationWarning || "",
          repaired: doc.navigationVersion === 2,
        };
      }
      case "libraryInfo":
        return {
          path: state.libraryPath || path.join(root, "library"),
          directories: Object.values(state.directories).map(clone),
          managed: Object.values(state.books).filter(
            (b) => b.storage !== "linked",
          ).length,
          linked: Object.values(state.books).filter(
            (b) => b.storage === "linked",
          ).length,
        };
      case "addDirectory": {
        const real = await realDirectory(a.path);
        return mutate(a.requestId, (next) => {
          const existing = Object.values(next.directories).find(
              (d) => d.path === real,
            ),
            d = {
              id: existing?.id || randomUUID(),
              path: real,
              recursive: a.recursive !== false,
              checkOnOpen: !!a.checkOnOpen,
              excludedPaths: a.excludedPaths || existing?.excludedPaths || [],
              lastScan: existing?.lastScan || null,
            };
          next.directories[d.id] = d;
          return { directory: d };
        });
      }
      case "removeDirectory":
        return mutate(a.requestId, (next) => {
          delete next.directories[a.id];
          return { removed: true };
        });
      case "migrateLibrary": {
        const target = await realDirectory(a.path, true);
        return mutate(a.requestId, async (next) => {
          const old = state.libraryPath || path.join(root, "library");
          if (target === old) return { path: old, copied: 0 };
          await atomic(
            path.join(
              root,
              "backups",
              now().replace(/[:.]/g, "-") + "-before-library-change.json",
            ),
            JSON.stringify({ state, previousLibrary: old }),
          );
          let copied = 0;
          for (const b of Object.values(next.books).filter(
            (b) => b.storage !== "linked",
          )) {
            const name = b.managedName || fileName(b);
            await copyVerified(
              asset(b, ".original"),
              path.join(target, name),
              b.hash,
            );
            b.managedName = name;
            copied++;
          }
          next.libraryPath = target;
          return {
            path: target,
            previous: old,
            copied,
            oldFilesRetained: true,
          };
        });
      }
      case "refreshDirectory": {
        const d = state.directories[a.id];
        if (!d) throw new Error("DIRECTORY_NOT_FOUND");
        const scan = await scanDirectory(d.path, { recursive: d.recursive });
        const results = [];
        for (const f of scan.items) {
          if ((d.excludedPaths || []).includes(f.path)) continue;
          try {
            if ((await fs.stat(f.path)).size > MAX_FILE)
              throw new Error("FILE_SIZE_LIMIT");
            const bytes = await fs.readFile(f.path);
            if (bytes.length > MAX_FILE) throw new Error("FILE_SIZE_LIMIT");
            results.push({
              ...(await importBytes(
                bytes,
                f.name,
                a.requestId + ":" + hash(Buffer.from(f.path)),
                a.encoding,
                { link: true, sourcePath: f.path, directoryId: d.id },
              )),
              name: f.name,
            });
          } catch (e) {
            results.push({ name: f.name, error: e.message });
          }
        }
        await mutate(a.requestId, (next) => {
          next.directories[a.id].lastScan = now();
          return { scanned: scan.items.length };
        });
        return { results, truncated: scan.truncated };
      }
      case "relinkBook": {
        if (!path.isAbsolute(a.path || ""))
          throw new Error("ABSOLUTE_DIRECTORY_REQUIRED");
        const source = await fs.realpath(a.path);
        if ((await fs.stat(source)).size > MAX_FILE)
          throw new Error("FILE_SIZE_LIMIT");
        const bytes = await fs.readFile(source),
          b = book(a.id);
        if (hash(bytes) !== b.hash) throw new Error("ORIGINAL_HASH_MISMATCH");
        return mutate(a.requestId, (next) => {
          const row = next.books[a.id];
          row.storage = "linked";
          row.sourcePath = source;
          row.managedName = "";
          row.revision++;
          return { book: row };
        });
      }
      case "read":
        return {
          revision: state.revision,
          books: Object.values(state.books).map(clone),
          settings: clone(state.settings),
          recordCount: Object.keys(state.records).length,
          root,
          libraryPath: state.libraryPath || path.join(root, "library"),
          directories: Object.values(state.directories).map(clone),
          preferences: clone(state.preferences),
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
          toc:
            d.toc ||
            d.chapters.map((c) => ({
              id: "nav-" + c.id,
              title: c.title,
              chapterId: c.id,
              depth: 0,
              textOffset: 0,
            })),
          navigationWarning: d.navigationWarning || "",
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
        const location = a.item?.location
          ? locationSchema.parse(a.item.location)
          : null;
        if (location) {
          if (location.chapterId !== a.chapterId)
            throw new Error("ANCHOR_MISMATCH");
          if (location.mode === "text") {
            const c = d.chapters.find((c) => c.id === a.chapterId);
            if (resolveTextLocation(c.text, location) !== location.textOffset)
              throw new Error("ANCHOR_MISMATCH");
          }
        }
        return mutate(a.requestId, (next) => {
          const b = next.books[a.id];
          b.progress = {
            ...b.progress,
            chapterId: a.chapterId,
            offset: Math.max(0, Number(a.offset) || 0),
            location,
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
              annotation: r.annotation,
            });
            r.history.at(-1).kind = r.kind;
            r.history.at(-1).questionState = r.questionState;
            if (a.item.kind !== undefined)
              r.kind = recordSchema.shape.kind.parse(a.item.kind);
            if (a.item.annotation !== undefined) {
              const appearance = annotationSchema.parse(a.item.annotation);
              if (
                !sameAnnotationState(
                  r,
                  { annotation: appearance, deleted: !!r.deletedAt },
                  false,
                )
              )
                r.annotationRevision = (r.annotationRevision || 0) + 1;
              r.annotation = appearance;
            }
            r.body = a.item.body !== undefined ? String(a.item.body) : r.body;
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
              annotation:
                anchor && !anchor.pageOnly
                  ? annotationSchema.parse(
                      a.item?.annotation || {
                        style: "highlight",
                        color: "yellow",
                      },
                    )
                  : null,
              origin: ["ai", "edited-ai"].includes(a.item?.origin)
                ? a.item.origin
                : "user",
              questionState: "open",
              reviewMeta: null,
              discussionId: a.item?.discussionId || "",
              createdAt: now(),
              updatedAt: now(),
              revision: 1,
              deletedAt: null,
              history: [],
            };
          }
          if (a.item?.reviewMeta) {
            const meta = reviewMetaSchema.parse(a.item.reviewMeta);
            const x = meta.discussionId ? exercise(meta.discussionId) : null;
            if (x && x.bookId !== a.bookId) throw new Error("RECORD_SCOPE");
            if (
              meta.recordIds.some(
                (id) => state.records[id]?.bookId !== a.bookId,
              ) ||
              meta.readerMessageIds.some(
                (id) =>
                  !x?.rows.some((row) => row.id === id && row.role === "user"),
              ) ||
              meta.assistantMessageIds.some(
                (id) =>
                  !x?.rows.some(
                    (row) => row.id === id && row.role === "assistant",
                  ),
              )
            )
              throw new Error("RECORD_SCOPE");
            r.reviewMeta = meta;
          }
          if (!r.body.trim() && !r.anchor) throw new Error("EMPTY_RECORD");
          recordSchema.parse(r);
          next.records[r.id] = r;
          return { record: r };
        });
      }
      case "annotateRecord":
        return mutate(a.requestId, (next) => {
          const r = next.records[a.id];
          if (!r || r.deletedAt) throw new Error("RECORD_NOT_FOUND");
          if (a.bookId && r.bookId !== a.bookId)
            throw new Error("RECORD_SCOPE");
          check(r, a.revision);
          if (!r.anchor || r.anchor.pageOnly)
            throw new Error("ANCHOR_MISMATCH");
          const appearance = annotationSchema.parse(a.item?.annotation);
          r.history.push({
            body: r.body,
            annotation: r.annotation,
            at: r.updatedAt,
            revision: r.revision,
          });
          if (
            !sameAnnotationState(
              r,
              { annotation: appearance, deleted: !!r.deletedAt },
              false,
            )
          )
            r.annotationRevision = (r.annotationRevision || 0) + 1;
          r.annotation = appearance;
          r.updatedAt = now();
          r.revision++;
          return { record: r };
        });
      case "trashRecord":
        return mutate(a.requestId, (next) => {
          const r = next.records[a.id];
          if (!r) throw new Error("RECORD_NOT_FOUND");
          check(r, a.revision);
          if (!!r.deletedAt !== !a.restore)
            r.annotationRevision = (r.annotationRevision || 0) + 1;
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
        if (a.bookId !== "__help__") book(a.bookId);
        findMethod(a.method || "free", state.methods);
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
            templateVersion: 3,
            model: a.item?.model || null,
            methodHistory: [],
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
  if (!state.libraryPath) {
    const next = clone(state);
    next.libraryPath = path.join(root, "library");
    await atomic(
      path.join(root, "backups", "before-0.3.0-library-upgrade.json"),
      JSON.stringify(state),
    );
    for (const b of Object.values(next.books).filter(
      (b) => b.storage !== "linked" && !b.managedName,
    )) {
      const source = path.join(root, "books", b.hash + ".original");
      try {
        await fs.access(source);
      } catch {
        continue;
      }
      const name = fileName(b);
      await copyVerified(source, path.join(next.libraryPath, name), b.hash);
      b.managedName = name;
    }
    next.revision++;
    await unit.setGlobal(next);
    state = next;
  }
  if (state.uxVersion < 5) {
    await atomic(
      path.join(root, "backups", "before-0.5.0-reading-assets.json"),
      JSON.stringify(state),
    );
    state = { ...state, uxVersion: 5, revision: state.revision + 1 };
    await unit.setGlobal(state);
  }
  return {
    action,
    reviewContext,
    methods,
    methodPreview,
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
