import { METHOD_GUIDANCE } from "./reading-methods.js";
import { METHODOLOGY_DETAILS } from "./methodology-details.js";
export const BUILTIN_METHODS = [
  {
    id: "free",
    name: { zh: "自由聊", en: "Chat" },
    description: {
      zh: "解释、翻译、感悟，想到什么就聊什么。",
      en: "Ask, translate or reflect naturally.",
    },
    starter: {
      zh: "请陪我读当前内容。",
      en: "Please read this passage with me.",
    },
  },
  {
    id: "hunt",
    name: { zh: "狩猎法", en: "Explore" },
    description: {
      zh: "从眼前的段落发现线索，问题可以边读边形成。",
      en: "Discover meaningful leads; questions can emerge as you read.",
    },
    starter: {
      zh: "我还没有明确问题，请从当前内容找一个值得追寻的线索。",
      en: "Find a meaningful lead in this passage; I do not have a specific question yet.",
    },
  },
  {
    id: "feynman",
    name: { zh: "费曼法", en: "Teach-back" },
    description: {
      zh: "先一起看懂，再用自己的话说明，随时可以请求提示。",
      en: "Understand together, then explain in your own words with hints when needed.",
    },
    starter: {
      zh: "先帮我理解这个概念，再听听我能否讲清楚。",
      en: "Explain the idea first, then help me teach it back.",
    },
  },
  {
    id: "debate",
    name: { zh: "辩论法", en: "Debate" },
    description: {
      zh: "检查观点的依据、反例与条件，形成自己的暂定判断。",
      en: "Examine evidence, counterexamples and limits to form a provisional judgment.",
    },
    starter: {
      zh: "这个观点在什么情况下不成立？",
      en: "Under what conditions would this claim not hold?",
    },
  },
].map((x) => ({
  ...x,
  ...METHODOLOGY_DETAILS[x.id],
  builtin: true,
  revision: 4,
  enabled: true,
  prompt: {
    zh:
      METHOD_GUIDANCE[x.id].replace(
        /(Respond naturally|Start with|Answer the|Identify a claim)[\s\S]*$/,
        "",
      ) +
      "\n\n当前书籍：{{book}}\n作者：{{author}}\n当前章节：{{chapter}}\n选中原文：{{selection}}",
    en:
      {
        free: "Respond naturally to the current reading question. Explain, translate or reflect without requiring goals or exercise prerequisites.",
        hunt: "Explore the current passage with the reader. Offer one useful lead when no question is defined. Never require a goal, identity or private experience. As questions emerge, find relevant sources, prerequisites and counterexamples. State actual coverage and avoid claiming to have read the whole book.",
        feynman:
          "Answer the immediate question first. Explain a concept or example when needed, then optionally invite teach-back. Probe one ambiguity at a time; acknowledge clear answers. Use examples, counterexamples, boundaries and transfer. Give hints; never force a quiz or fixed rounds. Describe demonstrated understanding without declaring mastery.",
        debate:
          "Identify and steelman a claim in the current passage. Do not require a stance or opponents in advance. Examine relevant support, counterexamples and conditions. Distinguish sourced quotations from simulated viewpoints. Preserve uncertainty and invite a provisional reader judgment.",
      }[x.id] +
      "\n\nBook: {{book}}\nAuthor: {{author}}\nChapter: {{chapter}}\nSelected passage: {{selection}}",
  },
}));
export function methodList(custom = {}, overrides = {}, versions = {}) {
  return [
    ...BUILTIN_METHODS.map((m) => ({
      ...m,
      ...overrides[m.id],
      revision: versions[m.id] || overrides[m.id]?.revision || m.revision,
      personalized: !!overrides[m.id],
    })),
    ...Object.values(custom),
  ];
}
export function findMethod(id, custom = {}) {
  const m = methodList(custom).find((x) => x.id === id);
  if (!m) throw new Error("METHOD_NOT_FOUND");
  return m;
}
export function localMethod(value, language = "zh") {
  return typeof value === "string"
    ? value
    : value?.[language] || value?.en || value?.zh || "";
}
export function compileMethod({
  method,
  language = "zh",
  book,
  chapter,
  anchor,
  notes = "",
  override,
}) {
  const values = {
    book: book.title || "",
    author: book.author || "",
    chapter: chapter?.title || "",
    selection: anchor?.quote || "",
    notes,
  };
  const template =
    typeof override === "string"
      ? override
      : localMethod(method.prompt, language);
  const prompt = template.replace(
    /\{\{\s*(book|author|chapter|selection|notes)\s*\}\}/g,
    (_all, key) => values[key],
  );
  return {
    id: method.id,
    name: localMethod(method.name, language),
    description: localMethod(method.description, language),
    revision: method.revision,
    prompt,
    template,
    temporary: typeof override === "string",
    variables: values,
  };
}
