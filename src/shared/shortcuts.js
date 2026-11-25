export const SHORTCUTS = [
  {
    id: "undoAnnotation",
    keys: ["Mod+KeyZ"],
    zh: "撤销上一步标注",
    en: "Undo annotation",
  },
  {
    id: "redoAnnotation",
    keys: ["Mod+Shift+KeyZ"],
    zh: "重做标注",
    en: "Redo annotation",
  },
  {
    id: "focus",
    keys: ["KeyF"],
    zh: "切换专注阅读",
    en: "Toggle focus reading",
  },
  {
    id: "returnReading",
    keys: ["KeyR"],
    zh: "返回刚才阅读位置",
    en: "Return to reading position",
  },
  { id: "down", keys: ["ArrowDown"], zh: "向下滚动", en: "Scroll down" },
  { id: "up", keys: ["ArrowUp"], zh: "向上滚动", en: "Scroll up" },
  {
    id: "forward",
    keys: ["Space", "PageDown", "ArrowRight"],
    zh: "下一屏 / 页",
    en: "Next screen / page",
  },
  {
    id: "backward",
    keys: ["Shift+Space", "PageUp", "ArrowLeft"],
    zh: "上一屏 / 页",
    en: "Previous screen / page",
  },
  { id: "start", keys: ["Home"], zh: "当前章节开头", en: "Start of chapter" },
  { id: "end", keys: ["End"], zh: "当前章节结尾", en: "End of chapter" },
  { id: "find", keys: ["Mod+KeyF"], zh: "搜索本书", en: "Search this book" },
  {
    id: "goto",
    keys: ["Mod+KeyG"],
    zh: "跳转章节 / 页",
    en: "Go to chapter / page",
  },
  {
    id: "bigger",
    keys: ["Equal", "Shift+Equal", "NumpadAdd"],
    zh: "增大字号 / 缩放",
    en: "Increase text size / zoom",
  },
  {
    id: "smaller",
    keys: ["Minus", "NumpadSubtract"],
    zh: "减小字号 / 缩放",
    en: "Decrease text size / zoom",
  },
  { id: "toc", keys: ["KeyT"], zh: "显示或收起目录", en: "Toggle contents" },
  {
    id: "bookmark",
    keys: ["KeyB"],
    zh: "记录当前位置",
    en: "Bookmark current location",
  },
  { id: "note", keys: ["KeyN"], zh: "给选段记笔记", en: "Note on selection" },
  {
    id: "ask",
    keys: ["KeyA"],
    zh: "把选段带给书虫",
    en: "Ask Bookworm about selection",
  },
  {
    id: "help",
    keys: ["Shift+Slash"],
    zh: "快捷键速查",
    en: "Shortcut reference",
  },
];
export const KEY_STORE = "arr-reading-shortcuts:v1";
export function shortcutConfig(overrides = {}) {
  return SHORTCUTS.map((s) => ({
    ...s,
    keys:
      Object.hasOwn(overrides, s.id) && Array.isArray(overrides[s.id])
        ? overrides[s.id].filter((x) => typeof x === "string")
        : s.keys,
  }));
}
export function chord(e) {
  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push("Mod");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  return [...mods, e.code].join("+");
}
export function reserved(key) {
  if (key === "Mod+KeyZ" || key === "Mod+Shift+KeyZ") return false;
  return (
    /Mod\+(?:Shift\+)?(?:KeyW|KeyQ|KeyR|KeyL|KeyT|KeyN|KeyC|KeyV|KeyX|KeyZ|KeyA|Tab)$/.test(
      key,
    ) || key === "Alt+F4"
  );
}
export function resolveShortcut(
  e,
  { editable = false, modal = false, overrides = {} } = {},
) {
  if (editable || modal || e.isComposing || e.defaultPrevented || e.altGraphKey)
    return null;
  const key = chord(e);
  if (reserved(key)) return null;
  return (
    shortcutConfig(overrides).find((x) => x.keys.includes(key))?.id || null
  );
}
export function keyLabel(key, mac = false) {
  return key
    .replace(/Mod/g, mac ? "⌘" : "Ctrl")
    .replace(/Key([A-Z])/g, "$1")
    .replace(/ArrowUp/g, "↑")
    .replace(/ArrowDown/g, "↓")
    .replace(/ArrowLeft/g, "←")
    .replace(/ArrowRight/g, "→")
    .replace(/Equal/g, "=")
    .replace(/Minus/g, "−")
    .replace(/Slash/g, "/")
    .replace(/Space/g, "Space")
    .replace(/NumpadAdd/g, "Num +")
    .replace(/NumpadSubtract/g, "Num −");
}
