import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createStore } from "./store.js";
import { parseBook, MAX_FILE } from "./parse.js";
import { createSpirit, METHODS } from "./spirit.js";
export const inject = [
  "storage",
  "storage.backend.json",
  "connection",
  "tools",
  "fs",
  "sessionProjections",
  "agents",
  "agentLoop",
  "sessionController",
  "systemPrompt",
  "llm",
];
const ROUTE = "/api/ai-reading-room";
export async function apply(ctx) {
  const unit = await ctx.storage.backend.get("json").kv.open({
    name: "ai_reading_room_v1",
    version: 1,
    tables: [],
    hasGlobal: true,
    layout: "single",
  });
  const root = path.join(
    process.env.DSH_HOME || path.join(os.homedir(), ".dsh"),
    "ai-reading-room",
  );
  const store = await createStore(unit, root);
  let spirit = await createSpirit(ctx, store);
  ctx.effect(() => async () => {
    await spirit?.close();
    spirit = null;
    await store.close();
  });
  const service = {
    async dispatch(a, signal, user = false) {
      if (!a || typeof a !== "object") throw new Error("INVALID_REQUEST");
      if (a.action === "methods") return { methods: METHODS };
      if (a.action === "exercise" && a.item?.open === true) {
        if (!spirit) throw new Error("SPIRIT_UNAVAILABLE");
        return spirit.operate({ id: a.id, command: "open" }, signal);
      }
      if (a.action === "spirit") {
        if (!user && !["read", "models"].includes(a.command))
          throw new Error("USER_ONLY");
        if (!spirit) throw new Error("SPIRIT_UNAVAILABLE");
        return spirit.operate(a, signal);
      }
      if (a.action === "importPath") {
        const target = await ctx.fs.resolve(String(a.path || "")),
          stat = await ctx.fs.stat(target, signal);
        if (stat?.type !== "file" || stat.size > MAX_FILE)
          throw new Error("FILE_SIZE_LIMIT");
        const bytes = await ctx.fs.readBytes(target, signal, MAX_FILE);
        return store.importBytes(
          bytes,
          path.basename(target.displayPath),
          a.requestId,
          a.encoding,
        );
      }
      if (a.action === "scan") {
        const target = await ctx.fs.resolve(String(a.path || "")),
          items = await ctx.fs.listDir(target, signal);
        return {
          items: items
            .filter(
              (x) =>
                x.type === "file" &&
                /\.(epub|pdf|txt|md|markdown)$/i.test(x.name),
            )
            .slice(0, 1000)
            .map((x) => ({
              name: x.name,
              path: x.target.displayPath,
              bytes: x.size,
            })),
          truncated: items.length > 1000,
        };
      }
      if (a.action === "restorePreview" || a.action === "restore") {
        if (!user) throw new Error("USER_ONLY");
        const bytes = Buffer.from(String(a.data || ""), "base64");
        if (bytes.length > 192 * 1024 * 1024)
          throw new Error("FILE_SIZE_LIMIT");
        if (a.action === "restorePreview")
          return (await store.previewRestore(bytes)).summary;
        await spirit?.close();
        spirit = null;
        try {
          return await store.restore(bytes, a.requestId, a.confirm);
        } finally {
          spirit = await createSpirit(ctx, store);
        }
      }
      return store.action(a);
    },
  };
  ctx.provide("aiReadingRoom", service);
  const register = (suffix, methods, fetch, requestBody = "buffered") =>
    ctx.effect(() =>
      ctx.connection.fetch.register({
        path: ROUTE + suffix,
        methods,
        requestBody,
        fetch,
      }),
    );
  register("", ["GET", "POST"], async (req) => {
    try {
      const a = req.method === "GET" ? { action: "read" } : await req.json();
      return Response.json(
        { ok: true, value: await service.dispatch(a, req.signal, true) },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (e) {
      return Response.json(
        { ok: false, error: e.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  });
  register(
    "/upload",
    ["POST"],
    async (req) => {
      try {
        const size = Number(req.headers.get("content-length") || 0);
        if (size > MAX_FILE) throw new Error("FILE_SIZE_LIMIT");
        const chunks = [];
        let count = 0;
        for await (const chunk of req.body) {
          count += chunk.length;
          if (count > MAX_FILE) throw new Error("FILE_SIZE_LIMIT");
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks),
          url = new URL(req.url);
        return Response.json({
          ok: true,
          value: await store.importBytes(
            bytes,
            url.searchParams.get("name") || "book.txt",
            url.searchParams.get("requestId") || randomUUID(),
            url.searchParams.get("encoding") || "utf-8",
          ),
        });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 400 });
      }
    },
    "streaming",
  );
  register("/original", ["GET"], async (req) => {
    try {
      const b = store.book(new URL(req.url).searchParams.get("id"));
      return new Response(await fs.readFile(store.asset(b, ".original")), {
        headers: {
          "Content-Type":
            b.format === "pdf" ? "application/pdf" : "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response("ORIGINAL_MISSING", { status: 404 });
    }
  });
  register("/cover", ["GET"], async (req) => {
    try {
      const doc = await store.document(new URL(req.url).searchParams.get("id"));
      const m = String(doc.cover || "").match(
        /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-zA-Z0-9+/=]+)$/,
      );
      if (!m) return new Response(null, { status: 404 });
      return new Response(Buffer.from(m[2], "base64"), {
        headers: {
          "Content-Type": m[1],
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  register("/backup", ["GET"], async (req) => {
    try {
      await spirit?.flush();
      const bytes = await store.backup(
        new URL(req.url).searchParams.get("originals") === "1",
      );
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition":
            'attachment; filename="ai-reading-room-backup.zip"',
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return new Response(e.message, { status: 400 });
    }
  });
  const packageRoot = path.dirname(fileURLToPath(import.meta.url));
  register("/pdf-resource", ["GET"], async (req) => {
    const url = new URL(req.url),
      kind = url.searchParams.get("kind"),
      name = url.searchParams.get("name") || "";
    if (
      !["cmaps", "standard_fonts", "wasm"].includes(kind) ||
      !/^[-a-zA-Z0-9_.]+$/.test(name) ||
      name === "." ||
      name === ".."
    )
      return new Response(null, { status: 404 });
    try {
      return new Response(
        await fs.readFile(path.join(packageRoot, "assets", kind, name)),
        {
          headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "public, max-age=86400",
          },
        },
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  register(
    "/pdf.worker.mjs",
    ["GET"],
    async () =>
      new Response(
        await fs.readFile(path.join(packageRoot, "assets", "pdf.worker.mjs")),
        {
          headers: {
            "Content-Type": "text/javascript",
            "Cache-Control": "public, max-age=86400",
          },
        },
      ),
  );
  ctx.effect(() =>
    ctx.tools.register({
      name: "reading_room",
      description:
        "管理 AI 书房：read 书库，open 单书与记录，chapter 原文，search 检索；saveRecord 保存学习记录，saveBook 修改标签/状态，trashRecord/trashBook 可恢复删除；methods 读三种方法，createExercise/saveExercise 记录练习。写入带 requestId，更新带最新 revision。书灵发送消息与恢复备份由用户在界面操作。",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "read",
              "open",
              "chapter",
              "search",
              "records",
              "saveRecord",
              "saveBook",
              "trashRecord",
              "trashBook",
              "newPass",
              "export",
              "methods",
              "createExercise",
              "saveExercise",
              "exercise",
              "importPath",
              "scan",
              "settings",
            ],
          },
          id: { type: "string" },
          bookId: { type: "string" },
          chapterId: { type: "string" },
          query: { type: "string" },
          path: { type: "string" },
          requestId: { type: "string" },
          revision: { type: "integer" },
          method: {
            type: "string",
            enum: ["free", "hunt", "feynman", "debate"],
          },
          goal: { type: "string" },
          restore: { type: "boolean" },
          item: { type: "object", additionalProperties: true },
        },
        required: ["action"],
        additionalProperties: false,
      },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_a, v) => [{ type: "text", text: JSON.stringify(v) }],
      },
      execute: (a, exec) => service.dispatch(a, exec.signal, false),
    }),
  );
}
