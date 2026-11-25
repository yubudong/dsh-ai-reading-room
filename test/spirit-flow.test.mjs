import test from "node:test";
import assert from "node:assert/strict";
import { createSpirit, METHODS } from "../src/host/spirit.js";
import {
  discussionContext,
  clampPanelWidth,
} from "../src/shared/reading-methods.js";
function fixture() {
  const exercise = {
    id: "x1",
    bookId: "b1",
    method: "free",
    goal: "",
    stage: 0,
    status: "paused",
    templateVersion: 1,
    model: null,
    methodHistory: [],
    rows: [
      { id: "old", role: "assistant", text: "Earlier reflection", time: 1 },
    ],
    contexts: {},
    receipts: [],
    citations: [],
    sessionId: "",
  };
  const calls = [],
    modelChanges = [];
  const settings = { replyLanguage: "auto", model: null };
  const chapter = {
    id: "c0",
    title: "Read together",
    text: "A concept can be understood by examples and its limits.",
  };
  const store = {
    exercise: () => structuredClone(exercise),
    book: () => ({ id: "b1", title: "Sample" }),
    document: async () => ({ title: "Sample", chapters: [chapter] }),
    settings: () => structuredClone(settings),
    validateAnchor: async (_id, a) => a || null,
    writeExercise: async (_id, fn) => {
      fn(exercise);
      return { exercise: structuredClone(exercise) };
    },
  };
  const agent = {
    id: "native-1",
    session: { id: "native-1" },
    model: { select: (selection) => modelChanges.push(selection) },
  };
  const listeners = new Map();
  const ac = {
    tools: {
      restrict: () => () => {},
      register: (spec) => {
        calls.push({ tool: spec });
        return () => {};
      },
    },
    systemPrompt: { section: () => () => {} },
    effect: (fn) => fn(),
    on: (key, fn) => {
      listeners.set(key, fn);
      return () => listeners.delete(key);
    },
  };
  const ctx = {
    sessionProjections: {
      register: async () => ({
        stateOf: () => ({ rows: [], busy: false, outcome: null }),
        dispose: async () => {},
      }),
    },
    agents: {
      create: async (opts) => {
        calls.push({ create: opts });
        opts.setup(ac, agent);
        return { agent, dispose: async () => {} };
      },
      resume: async () => ({ agent, dispose: async () => {} }),
    },
    llm: { resolveCallConfig: async (x) => ({ ...x }) },
    sessionController: {
      modelCatalog: async () => ({
        default: { provider: "p", model: "m1" },
        groups: [
          {
            id: "p",
            name: "Provider",
            models: [
              { id: "m1", name: "One" },
              { id: "m2", name: "Two" },
            ],
          },
        ],
      }),
      rename: async () => {},
      cancel: () => {},
      prompt: async (req) => {
        calls.push({ prompt: req });
        listeners.get("session/event")?.(agent.session, { type: "turn/start" });
      },
    },
  };
  return {
    ctx,
    store,
    exercise,
    calls,
    modelChanges,
    chapter,
    settings,
    listeners,
  };
}
test("methods work with no goal and follow the current passage, not a required questionnaire", () => {
  for (const method of ["free", "hunt", "feynman", "debate"]) {
    const f = fixture(),
      context = discussionContext({
        exercise: f.exercise,
        method,
        language: "auto",
        chapter: f.chapter,
        anchor: null,
        settings: f.settings,
      });
    assert.equal(context.method, method);
    assert.equal(context.templateVersion, 2);
    assert.equal(context.previousReaderGoal, undefined);
    assert.equal(context.source.chapterId, "c0");
    assert.match(context.interaction, /No required questionnaire/);
    assert.equal(context.instructions, METHODS[method].prompt);
  }
});
test("first message creates a native discussion without a goal, and switches methods within that discussion", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  try {
    await spirit.operate({
      command: "send",
      id: "x1",
      text: "Read this with me",
      method: "hunt",
      chapterId: "c0",
      language: "auto",
      requestId: "request-one",
    });
    assert.equal(f.exercise.status, "active");
    assert.equal(f.exercise.goal, "");
    assert.equal(f.exercise.method, "hunt");
    assert.equal(f.exercise.templateVersion, 3);
    assert.equal(f.exercise.rows[0].text, "Earlier reflection");
    assert.equal(f.calls.filter((x) => x.create).length, 1);
    assert.equal(
      JSON.parse(
        f.calls
          .find((x) => x.prompt)
          .prompt.content[1].text.split("\n")
          .slice(2)
          .join("\n"),
      ).method,
      "hunt",
    );
    await spirit.operate({
      command: "send",
      id: "x1",
      text: "Challenge the claim",
      method: "debate",
      chapterId: "c0",
      requestId: "request-two",
    });
    assert.equal(f.calls.filter((x) => x.create).length, 1);
    assert.equal(f.exercise.method, "debate");
    assert.deepEqual(
      f.exercise.methodHistory.map((x) => x.method),
      ["hunt", "debate"],
    );
    await spirit.operate({
      command: "send",
      id: "x1",
      text: "Challenge the claim",
      method: "debate",
      chapterId: "c0",
      requestId: "request-two",
    });
    assert.equal(f.calls.filter((x) => x.prompt).length, 2);
  } finally {
    await spirit.close();
  }
});
test("model selection is durable and applied to the existing agent, without changing deployment settings", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  try {
    await spirit.operate({ command: "open", id: "x1" });
    await spirit.operate({
      command: "selectModel",
      id: "x1",
      selection: { provider: "p", model: "m2" },
    });
    assert.deepEqual(f.exercise.model, { provider: "p", model: "m2" });
    assert.equal(f.settings.model, null);
    assert.equal(f.modelChanges.at(-1).model, "m2");
    await spirit.operate({
      command: "send",
      id: "x1",
      method: "feynman",
      text: "Please explain first",
      chapterId: "c0",
      requestId: "model-request",
    });
    assert.equal(f.modelChanges.at(-1).model, "m2");
    await assert.rejects(
      () =>
        spirit.operate({
          command: "selectModel",
          id: "x1",
          selection: { provider: "p", model: "missing" },
        }),
      /MODEL_REQUIRED/,
    );
    assert.equal(f.exercise.model.model, "m2");
    await spirit.operate({ command: "selectModel", id: "x1", selection: null });
    assert.equal(f.exercise.model, null);
    assert.equal(f.modelChanges.at(-1).model, "m1");
  } finally {
    await spirit.close();
  }
});
test("storage failure during send resets pending state so a retry is possible", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  await spirit.operate({ command: "open", id: "x1" });
  const save = f.store.writeExercise;
  f.store.writeExercise = async () => {
    throw new Error("disk full");
  };
  await assert.rejects(
    () =>
      spirit.operate({
        command: "send",
        id: "x1",
        method: "free",
        text: "Help",
        requestId: "fail",
      }),
    /disk full/,
  );
  assert.equal(
    (await spirit.operate({ command: "read", id: "x1" })).busy,
    false,
  );
  f.store.writeExercise = save;
  await spirit.close();
});
test("panel resizing reserves a readable main column and retains useful desktop limits", () => {
  assert.equal(clampPanelWidth(100, 1400, 200), 320);
  assert.equal(clampPanelWidth(2000, 1400, 200), 880);
  assert.equal(clampPanelWidth(600, 1600, 200), 600);
  assert.equal(clampPanelWidth(700, 900, 200), 380);
  assert.equal(clampPanelWidth(NaN, 1400, 200), 420);
});

test("sent method instructions exactly match the preview and stale previews are rejected", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  f.store.methodPreview = async () => ({
    id: "custom_test",
    name: "My method",
    revision: 7,
    prompt: "Exact visible instruction",
    hash: "current-preview",
  });
  try {
    await spirit.operate({
      command: "send",
      id: "x1",
      method: "custom_test",
      text: "Read along",
      chapterId: "c0",
      requestId: "exact-prompt",
      promptHash: "current-preview",
    });
    const context = f.exercise.contexts["exact-prompt"];
    assert.equal(context.instructions, "Exact visible instruction");
    assert.equal(context.methodSnapshot.revision, 7);
    await assert.rejects(
      () =>
        spirit.operate({
          command: "send",
          id: "x1",
          method: "custom_test",
          text: "Next",
          chapterId: "c0",
          requestId: "stale-prompt",
          promptHash: "old-preview",
        }),
      /PROMPT_CHANGED/,
    );
    assert.equal(f.calls.filter((x) => x.prompt).length, 1);
  } finally {
    await spirit.close();
  }
});
test("usage-help mode uses the current manual without sending the selected book excerpt", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  try {
    await spirit.operate({
      command: "send",
      id: "x1",
      method: "debate",
      text: "怎么导入目录？",
      chapterId: "c0",
      requestId: "help-request",
      uiLanguage: "zh",
    });
    const c = f.exercise.contexts["help-request"];
    assert.equal(c.source, null);
    assert.equal(c.usageHelp.version, "0.5.2");
    assert.equal(c.methodSnapshot.variables.chapter, "");
    assert.match(c.usageHelp.rule, /directly/);
  } finally {
    await spirit.close();
  }
});

test("native quote registration rejects unread text and returns exact verified offsets", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  try {
    await spirit.operate({ command: "open", id: "x1" });
    const tool = f.calls.find((x) => x.tool).tool;
    await assert.rejects(
      () =>
        tool.execute({ action: "cite", chapterId: "c0", quote: "understood" }),
      /CITATION_NOT_READ/,
    );
    await tool.execute({ action: "chapter", chapterId: "c0", offset: 5 });
    const ref = await tool.execute({
      action: "cite",
      chapterId: "c0",
      quote: "understood",
    });
    assert.equal(ref.start, f.chapter.text.indexOf("understood"));
    assert.equal(
      f.exercise.citationRefs[ref.citation.slice(1, -1)].quote,
      "understood",
    );
  } finally {
    await spirit.close();
  }
});
test("reply depth is captured per turn and a follow-up retains the previous reading window", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  f.settings.replyLength = "short";
  f.chapter.text = "x".repeat(6000);
  try {
    await spirit.operate({
      command: "send",
      id: "x1",
      text: "Explain this part",
      chapterId: "c0",
      readingOffset: 4500,
      requestId: "depth-one",
    });
    assert.equal(f.exercise.contexts["depth-one"].source.offset, 2500);
    assert.equal(f.exercise.contexts["depth-one"].replyStyle.length, "short");
    f.settings.replyLength = "deep";
    await spirit.operate({
      command: "send",
      id: "x1",
      text: "Give an example for the previous answer",
      chapterId: "c0",
      readingOffset: 0,
      followup: true,
      requestId: "depth-two",
    });
    assert.equal(f.exercise.contexts["depth-two"].source.offset, 2500);
    assert.equal(f.exercise.contexts["depth-two"].replyStyle.length, "deep");
    assert.equal(f.exercise.contexts["depth-one"].replyStyle.length, "short");
  } finally {
    await spirit.close();
  }
});
test("reading reviews use explicitly bounded source material and keep AI suggestions separate", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  let input;
  f.store.reviewContext = async (a) => {
    input = a;
    return {
      bookId: "b1",
      chapterId: "c0",
      readerStatements: [{ id: "u", text: "My stated understanding" }],
      assistantSuggestions: [
        { id: "a", text: "An AI suggestion", origin: "ai" },
      ],
      savedRecords: [],
      currentExcerpt: { chapterId: "c0", offset: 0, text: f.chapter.text },
    };
  };
  try {
    await spirit.operate({
      command: "send",
      id: "x1",
      text: "Organize a reading review draft",
      chapterId: "c0",
      review: true,
      reviewSince: "2026-11-25T01:00:00Z",
      reviewUntil: "2026-11-25T02:00:00Z",
      requestId: "review-turn",
    });
    const context = f.exercise.contexts["review-turn"];
    assert.equal(context.mode, "reading-review");
    assert.equal(
      context.reviewSource.readerStatements[0].text,
      "My stated understanding",
    );
    assert.match(context.instructions, /不能把用户的问题/);
    assert.equal(input.until, "2026-11-25T02:00:00Z");
    const tool = f.calls.find((x) => x.tool).tool;
    assert.ok(!tool.parameters.properties.action.enum.includes("saveRecord"));
  } finally {
    await spirit.close();
  }
});

test("assistant reference snapshots use the same sequence fallback as transcript projection", async () => {
  const f = fixture(),
    spirit = await createSpirit(f.ctx, f.store);
  await spirit.operate({ command: "open", id: "x1" });
  const tool = f.calls.find((x) => x.tool).tool;
  await tool.execute({ action: "chapter", chapterId: "c0", offset: 0 });
  const ref = await tool.execute({
    action: "cite",
    chapterId: "c0",
    quote: "concept",
  });
  f.listeners.get("session/event")(
    { id: "native-1" },
    {
      type: "assistant/message",
      seq: 42,
      data: {
        message: { content: [{ type: "text", text: "See " + ref.citation }] },
      },
    },
  );
  await spirit.close();
  assert.equal(
    f.exercise.replyReferences["42"][ref.citation.slice(1, -1)].quote,
    "concept",
  );
});
