export const REPLY_GUIDANCE = {
  short: "先直接回应眼前问题，通常用1—3个短段落或少量要点；只保留必要解释。",
  balanced:
    "先直接回应眼前问题，通常用3—6个短段落，必要时补一个例子；避免长篇铺陈。",
  deep: "按问题需要深入解释依据、例子和边界，保持结构清楚，避免重复与无关扩展。",
};
export const REPLY_COMMON =
  "用户明确要求的深浅优先于默认偏好。每轮最多一个主要追问，也可以不追问；允许直接继续阅读，不催促填写目标或每轮总结。明确区分作者原意、补充解释和推测/模拟，引用必须可核对。";
export const REVIEW_PROMPT =
  "这是用户主动要求的本次阅读回顾草稿，暂停常规方法练习。仅根据reviewSource中的实际材料整理；当前章节摘录只供出处核对，不代表用户已阅读或掌握整段。不检索未读内容，不声称读完全书。按“本次读到的内容”“用户亲自表达的理解”“仍未解决的问题”“书虫整理建议（AI生成）”“可以尝试的小行动（可选草稿）”组织。只有用户明确表达过的内容可列为用户理解，不能把用户的问题、助手回答、模拟观点当成用户已经掌握。无证据时明确留空或写尚未形成。未完成或被截取的材料应说明限制，不补造未给出的内容。引用用户的话时保持原意，并说明来源。行动必须很小、可选择，不创建任务、日程或提醒，不宣称已保存。输出供用户审阅修改，不向用户要求完成问卷。";
export function collectReviewSource({
  book,
  chapter,
  exercise,
  records = [],
  since,
  until = new Date().toISOString(),
  readingOffset = 0,
}) {
  const lo = Date.parse(since),
    hi = Date.parse(until);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi)
    throw new Error("REVIEW_RANGE_INVALID");
  const inRange = (value) => {
    const time = new Date(value).getTime();
    return time >= lo && time <= hi;
  };
  const rows = (exercise?.rows || []).filter((r) => inRange(r.time)),
    saved = records.filter(
      (r) =>
        r.bookId === book.id &&
        !r.deletedAt &&
        (inRange(r.createdAt) || inRange(r.updatedAt)),
    );
  const user = rows.filter((r) => r.role === "user"),
    ai = rows.filter((r) => r.role === "assistant");
  return {
    bookId: book.id,
    bookTitle: book.title,
    chapterId: chapter?.id || "",
    discussionId: exercise?.id || "",
    since,
    until,
    readerStatements: user.slice(-20).map((r) => ({
      id: r.id,
      time: r.time,
      text: String(r.text).slice(0, 800),
    })),
    assistantSuggestions: ai.slice(-6).map((r) => ({
      id: r.id,
      time: r.time,
      text: String(r.text).slice(0, 800),
      origin: "ai",
      interrupted: !!r.interrupted,
    })),
    savedRecords: saved.slice(-12).map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body.slice(0, 1000),
      origin: r.origin,
      questionState: r.questionState || "open",
      anchor: r.anchor
        ? {
            chapterId: r.anchor.chapterId,
            start: r.anchor.start,
            end: r.anchor.end,
            quote: r.anchor.quote.slice(0, 500),
          }
        : null,
    })),
    currentExcerpt: chapter
      ? {
          chapterId: chapter.id,
          title: chapter.title,
          text: chapter.text.slice(
            Math.max(0, readingOffset - 500),
            Math.max(0, readingOffset - 500) + 4000,
          ),
          offset: Math.max(0, readingOffset - 500),
        }
      : null,
    counts: {
      reader: user.length,
      assistant: ai.length,
      records: saved.length,
    },
    truncated:
      user.length > 20 ||
      ai.length > 6 ||
      saved.length > 12 ||
      user.some((r) => String(r.text).length > 800) ||
      ai.some((r) => String(r.text).length > 800) ||
      saved.some(
        (r) => r.body.length > 1000 || (r.anchor?.quote?.length || 0) > 500,
      ),
  };
}
export function initialReviewDraft(source, language = "zh") {
  const zh = language !== "en";
  const own = source.savedRecords.filter(
    (r) =>
      r.origin === "user" &&
      ["reflection", "note"].includes(r.kind) &&
      r.body.trim(),
  );
  const questions = source.savedRecords.filter(
    (r) => r.kind === "question" && r.questionState !== "understood",
  );
  return (
    "# " +
    (zh ? "本次阅读回顾" : "Reading review") +
    "\n\n" +
    source.bookTitle +
    "\n" +
    source.since +
    " → " +
    source.until +
    "\n\n## " +
    (zh
      ? "我的理解（由我核对和补充）"
      : "My understanding — for me to verify") +
    "\n\n" +
    (own.length
      ? own.map((r) => "- " + r.body).join("\n")
      : zh
        ? "待我自己补充。"
        : "For me to add.") +
    "\n\n## " +
    (zh
      ? "我在讨论中说过的话（供核对，不等同于已掌握）"
      : "My words in the discussion — not proof of mastery") +
    "\n\n" +
    (source.readerStatements
      .map((r) => "> " + r.text.replace(/\n/g, "\n> "))
      .join("\n\n") ||
      (zh ? "本次范围内暂无。" : "None in this time window.")) +
    "\n\n## " +
    (zh ? "仍未解决的问题" : "Open questions") +
    "\n\n" +
    (questions
      .map((r) => "- " + (r.body || r.anchor?.quote || ""))
      .join("\n") || (zh ? "待我补充。" : "For me to add.")) +
    "\n\n## " +
    (zh
      ? "书虫整理建议（AI来源，需审阅）"
      : "Bookworm suggestions — AI origin, review required") +
    "\n\n" +
    (zh
      ? "可主动请求书虫整理，然后选择是否插入。"
      : "Ask Bookworm to organize a draft, then choose whether to insert it.") +
    "\n\n## " +
    (zh
      ? "值得试一次的小行动（可选草稿）"
      : "One small experiment — optional draft") +
    "\n\n" +
    (zh
      ? "- 我想尝试：\n- 我准备观察：\n\n这里只保存阅读草稿，不自动创建待办或提醒。"
      : "- I might try:\n- I will observe:\n\nThis is a reading draft only; no task or reminder is created.")
  );
}
