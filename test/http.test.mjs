import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { apply } from "../src/host/index.js";
function host() {
  let global;
  const routes = new Map(),
    tools = new Map(),
    services = new Map(),
    effects = [];
  const unit = {
    loadAll: async () => ({ tables: {}, global }),
    setGlobal: async (value) => {
      global = structuredClone(value);
    },
    close: async () => {},
  };
  const ctx = {
    storage: { backend: { get: () => ({ kv: { open: async () => unit } }) } },
    sessionProjections: {
      register: async () => ({
        stateOf: () => ({ rows: [], busy: false }),
        dispose: async () => {},
      }),
    },
    connection: {
      fetch: {
        register: (route) => {
          routes.set(route.path, route);
          return async () => routes.delete(route.path);
        },
      },
    },
    tools: {
      register: (def) => {
        tools.set(def.name, def);
        return () => tools.delete(def.name);
      },
    },
    provide: (key, value) => services.set(key, value),
    effect: (fn) => {
      const dispose = fn();
      effects.push(dispose);
      return dispose;
    },
  };
  return {
    ctx,
    routes,
    tools,
    services,
    close: async () => {
      for (const d of effects.reverse()) await d?.();
    },
  };
}
test("UI route and agent tool share business semantics and errors", async (t) => {
  const h = host();
  await apply(h.ctx);
  t.after(() => h.close());
  const route = h.routes.get("/api/ai-reading-room"),
    tool = h.tools.get("reading_room");
  const toolResult = await tool.execute(
    { action: "read" },
    { signal: AbortSignal.timeout(500) },
  );
  const response = await route.fetch(
    new Request("http://localhost/api/ai-reading-room"),
  );
  assert.equal(response.status, 200);
  const uiResult = (await response.json()).value;
  assert.deepEqual(uiResult, toolResult);
  const x = await route.fetch(
    new Request("http://localhost/api/ai-reading-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", id: "missing" }),
    }),
  );
  assert.equal(x.status, 400);
  assert.equal((await x.json()).error, "BOOK_NOT_FOUND");
  await assert.rejects(
    () =>
      tool.execute(
        { action: "open", id: "missing" },
        { signal: AbortSignal.timeout(500) },
      ),
    /BOOK_NOT_FOUND/,
  );
  await assert.rejects(
    () =>
      h.services
        .get("aiReadingRoom")
        .dispatch(
          { action: "restore", data: "", requestId: randomUUID() },
          undefined,
          false,
        ),
    /USER_ONLY/,
  );
});
