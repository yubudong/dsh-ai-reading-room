export const METHOD_IDS = ["free", "hunt", "feynman", "debate"];
export const METHOD_VERSION = 2;
export function readingMethod(value) {
  if (!METHOD_IDS.includes(value)) throw new Error("INVALID_METHOD");
  return value;
}
export const METHOD_GUIDANCE = {
  free: "自然回应当前阅读问题，结合原文解释、讨论、翻译或整理；不要求先填写目标或完成练习。Respond naturally to the current reading question without a goal form or exercise prerequisites.",
  hunt: "从正在阅读或选中的内容出发，帮助读者发现值得追寻的线索、触动和与生活的联系。读者还没有问题时，先解释或指出一个有依据的切入点，可以轻轻问一个具体问题，但不要反复追问“你想解决什么”、身份或目标。问题自然出现后再据此定位相关章节、前置知识、反例与适用限制。没有读全书就说明覆盖范围，不机械筛选20%。允许只是阅读、暂时不回答、不联系私人经历，也允许不同意作者。Start with the current passage and discover meaningful leads together; never require a predefined goal. Once a question emerges, locate relevant passages, prerequisites and counterexamples. Ask one optional, concrete question at a time.",
  feynman:
    "围绕当前段落或读者刚问到的概念帮助理解。先回应当下问题；读者还不理解时先给简明解释或例子，不把“先讲给我听”当成准入条件。已有一点理解时再邀请用自己的话复述，围绕一个具体模糊点追问。逐步用例子、反例、适用边界和新情境检验理解，正确清楚的回答予以承认，不强行挑错，不凑固定轮数。允许拒绝练习、请求提示或直接继续读。反馈具体、尊重，不宣称完全掌握。Answer the immediate question first. Explain when needed, then optionally invite teach-back, examples and transfer. No mandatory explanation or quiz before help.",
  debate:
    "以当前原文或读者提到的观点为讨论起点。尚未明确论点时，先从原文准确提取一个值得辨析的主张，并允许读者纠正；不要求先填论点、对手或立场。准确还原作者最强且有依据的论证，再选择相关视角提供证据、反例或推理。模拟人物与作者回应明确标注为推演，不虚构引语、研究或事实，不凭姓名裁决。说明支持、条件、证据不足和未决分歧，邀请而不强迫读者形成暂定判断。Identify a claim from the passage when needed; do not require a stance or opponents in advance. Steelman, examine relevant challenges, distinguish simulation from sourced claims, and preserve uncertainty.",
};
export function discussionContext({
  exercise,
  method,
  language,
  chapter,
  anchor,
  settings,
  readingOffset = 0,
  sourceStart,
}) {
  const selected = readingMethod(method || exercise.method || "free");
  const start = Math.max(
    0,
    sourceStart ?? (anchor?.start ?? readingOffset ?? 0) - 2000,
  );
  return {
    bookId: exercise.bookId,
    method: selected,
    instructions: METHOD_GUIDANCE[selected],
    templateVersion: METHOD_VERSION,
    previousReaderGoal: exercise.goal || undefined,
    interaction:
      "Read alongside the reader. Goals and questions may emerge later. No required questionnaire or manual stage sequence. The current method overrides earlier methods for this turn.",
    replyLanguage:
      settings.replyLanguage === "auto"
        ? language || "auto"
        : settings.replyLanguage,
    coverage:
      "selected passage and bounded current chapter excerpt; other chapters require tools",
    source: chapter
      ? {
          citation: "[" + chapter.id + "]",
          chapterId: chapter.id,
          title: chapter.title,
          selected: anchor,
          text: chapter.text.slice(start, start + 12000),
          offset: start,
          totalChars: chapter.text.length,
        }
      : null,
    portableHistory: !exercise.sessionId ? exercise.rows.slice(-20) : undefined,
  };
}
export function panelLimits(containerWidth, tocWidth = 0) {
  const available = Math.max(0, Number(containerWidth) || 0);
  const max = Math.max(320, available - tocWidth - 320);
  return { min: 320, max: Math.min(1100, max) };
}
export function clampPanelWidth(width, containerWidth, tocWidth = 0) {
  const { min, max } = panelLimits(containerWidth, tocWidth);
  const value = Number(width);
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 420));
}
export function tocPanelLimits(containerWidth, dockWidth = 0) {
  return {
    min: 140,
    max: Math.max(
      140,
      Math.min(
        600,
        (Number(containerWidth) || 0) - (Number(dockWidth) || 0) - 320,
      ),
    ),
  };
}
export function clampTocWidth(width, containerWidth, dockWidth = 0) {
  const { min, max } = tocPanelLimits(containerWidth, dockWidth);
  const value = Number(width);
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 200));
}
