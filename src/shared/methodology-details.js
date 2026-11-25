export const METHODOLOGY_DETAILS = {
  free: {
    scenario: {
      zh: "随时想解释、翻译或聊聊感受。",
      en: "Any time you want an explanation, translation or reflection.",
    },
    usage: {
      zh: "直接输入问题或选中一段文字。不需要填写目标。",
      en: "Type a question or select a passage. No goal is required.",
    },
  },
  hunt: {
    scenario: {
      zh: "刚开始读一本书还没有明确问题；某段话让你好奇，想知道与自己的经历有什么联系。",
      en: "You are starting without a defined question, or a passage sparks curiosity and personal connections.",
    },
    usage: {
      zh: "1. 读一段或选中触动你的文字。\n2. 输入“这里有什么值得我注意的？”或点击陪我读当前内容。\n3. 跟随一个具体线索讨论，写下自己的理解和仍未解决的问题。可以暂时不回答追问，也不必透露私人经历。",
      en: "1. Read or select a meaningful passage.\n2. Ask “What is worth noticing here?” or choose Read this with me.\n3. Follow a concrete lead and keep your understanding and open questions. You can decline personal questions.",
    },
  },
  feynman: {
    scenario: {
      zh: "概念似懂非懂，想检查自己是否真的理解；能够复述，却不确定如何应用。",
      en: "A concept feels familiar but unclear, or you can repeat it without knowing how to apply it.",
    },
    usage: {
      zh: "1. 没看懂时先让书虫解释。\n2. 有一点理解后，用自己的话说一遍并举例。\n3. 让书虫围绕模糊处、反例或新情境帮你检查，再重新解释。卡住时随时请求提示，不是必须完成的考试。\n试试：“先帮我理解这段，再听听我讲得对不对。”",
      en: "1. Ask for an explanation first when needed.\n2. Explain it in your own words and give an example.\n3. Check ambiguities, counterexamples and transfer, then explain again. Hints are always allowed; this is not a required test.\nTry: “Explain this first, then listen to my explanation.”",
    },
  },
  debate: {
    scenario: {
      zh: "遇到强烈认同、怀疑或有争议的观点，想弄清它的依据与适用范围。",
      en: "You strongly agree with or doubt a claim and want to examine its support and limits.",
    },
    usage: {
      zh: "1. 选中作者的观点，或让书虫从当前段落提取。\n2. 比较最有力的支持、反例和适用条件。\n3. 说说自己保留什么、修改什么、还想查什么；也可以暂时不下结论。模拟人物观点必须与真实引语区分。\n试试：“这个观点在什么情况下不成立？”",
      en: "1. Select a claim or let Bookworm identify one.\n2. Compare its strongest support, counterexamples and conditions.\n3. Keep, revise or defer your judgment. Simulated viewpoints must be distinguished from real quotations.\nTry: “When would this claim not hold?”",
    },
  },
};
export function prepareReadingTurn({ message, textOverride, promptOverride }) {
  return {
    text: typeof textOverride === "string" ? textOverride : message,
    override: typeof promptOverride === "string" ? promptOverride : undefined,
  };
}
export function shouldShowMethodIntro(method, pref) {
  return !pref?.seenRevision || !pref.skip;
}
