export const errors = {
  BACKUP_SIZE_LIMIT: [
    "备份解压后超过首版 192 MiB 限制，请改用不含原书的备份，或先导出各书笔记。",
    "Backup exceeds the 192 MiB uncompressed limit. Exclude originals or export notes per book.",
  ],
  FILE_SIZE_LIMIT: [
    "单本文件上限为 64 MiB，或文件内容为空。",
    "The book is empty or exceeds the 64 MiB limit.",
  ],
  BAD_PDF: ["无法识别此 PDF 文件。", "This is not a readable PDF."],
  PDF_PAGE_LIMIT: [
    "PDF 超过 2500 页，请拆分后导入。",
    "PDF exceeds 2,500 pages; split it before import.",
  ],
  BAD_ZIP: [
    "电子书或备份容器已损坏。",
    "The ebook or backup archive is malformed.",
  ],
  ZIP_LIMIT: [
    "压缩包超过体积限制，或包含不安全的路径。",
    "The archive exceeds size limits or contains unsafe paths.",
  ],
  EPUB_ENCRYPTED: [
    "该 EPUB 含加密资源，首版暂不支持。",
    "Encrypted EPUB resources are not supported in this version.",
  ],
  EPUB_MISSING_RESOURCE: [
    "EPUB 缺少目录或正文资源。",
    "The EPUB is missing a required resource.",
  ],
  EPUB_CONTAINER: ["EPUB 的内容清单无效。", "The EPUB container is invalid."],
  EPUB_NO_CHAPTERS: [
    "未找到可阅读的 EPUB 章节。",
    "No readable EPUB chapters were found.",
  ],
  TEXT_ENCODING: [
    "无法按所选编码读取，请更换 TXT 编码。",
    "Cannot decode the text; choose another encoding.",
  ],
  UNSUPPORTED_FORMAT: [
    "支持 EPUB、PDF、TXT 和 Markdown；其他格式尚未开放。",
    "Supported formats are EPUB, PDF, TXT and Markdown.",
  ],
  BOOK_NOT_FOUND: [
    "找不到这本书，可能已在回收站。",
    "Book not found; it may be in Trash.",
  ],
  CHAPTER_NOT_FOUND: ["找不到这个章节或页面。", "Chapter or page not found."],
  RECORD_NOT_FOUND: ["找不到这条记录。", "Record not found."],
  EXERCISE_NOT_FOUND: ["找不到这次练习。", "Exercise not found."],
  ANCHOR_MISMATCH: [
    "原文位置已变化，请重新选择片段。",
    "Source position changed. Select the passage again.",
  ],
  EMPTY_RECORD: [
    "请写下内容或选择一段原文。",
    "Write something or select a source passage.",
  ],
  RECORD_SCOPE: [
    "记录不属于当前书籍。",
    "This record belongs to another book.",
  ],
  BAD_BACKUP: [
    "备份内容不完整或关联无效。",
    "Backup content is incomplete or invalid.",
  ],
  BACKUP_VERSION: [
    "备份版本不受支持，请使用对应版本插件。",
    "Unsupported backup version. Use a compatible plugin release.",
  ],
  BACKUP_HASH: [
    "备份中的原书校验失败。",
    "An original file failed its backup integrity check.",
  ],
  BACKUP_TEXT_MISMATCH: [
    "备份的正文与定位文本不一致。",
    "Backup text does not match its source content.",
  ],
  MODEL_REQUIRED: [
    "请先在 DSH 模型设置中配置可用模型。",
    "Configure an available model in DSH first.",
  ],
  SPIRIT_BUSY: [
    "书灵正在回复，请等待或停止当前回复。",
    "Book Spirit is replying. Wait or stop the current response.",
  ],
  EXERCISE_PAUSED: ["请先继续这次练习。", "Resume this exercise first."],
  MESSAGE_REQUIRED: [
    "请输入 1—16000 字符的消息。",
    "Enter a message between 1 and 16,000 characters.",
  ],
  GOAL_REQUIRED: [
    "请先写下这次练习的目标或问题。",
    "Enter a goal or question first.",
  ],
  SPIRIT_UNAVAILABLE: [
    "书灵服务尚未就绪，请稍后重试。",
    "Book Spirit is not ready. Try again shortly.",
  ],
  SPIRIT_CLOSED: [
    "书灵正在重新加载，请重新打开讨论。",
    "Book Spirit is reloading. Reopen the discussion.",
  ],
  STORE_CLOSED: [
    "书房正在重新加载，请刷新后重试。",
    "The reading room is reloading. Refresh and retry.",
  ],
  REQUEST_ID_REQUIRED: [
    "保存请求缺少标识，请重新打开操作。",
    "Missing request identifier. Reopen this action.",
  ],
  INVALID_REQUEST: ["请求格式无效。", "Invalid request."],
  UNKNOWN_ACTION: ["暂不支持这个操作。", "This action is not supported."],
  USER_ONLY: [
    "请在书房界面完成这个操作。",
    "Complete this action in the reading-room interface.",
  ],
  CONFIRM_REQUIRED: [
    "请核对恢复预览并确认。",
    "Review and confirm the restore preview.",
  ],
};
export function localizeError(code, t) {
  if (code === "REVISION_CONFLICT") return t("conflict");
  if (code === "ORIGINAL_MISSING") return t("missingOriginal");
  return errors[code] ? t("error." + code) : code;
}
export const API = "/api/ai-reading-room";
export const request = () => crypto.randomUUID();
export async function rpc(a, signal) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(a),
    signal,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data.value;
}
export function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function base64File(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
export const stageNames = {
  free: { zh: ["交流", "回顾"], en: ["Discuss", "Reflect"] },
  hunt: {
    zh: ["明确问题", "阅读路线", "联系自身", "我的理解"],
    en: ["Question", "Reading route", "Personal context", "My understanding"],
  },
  feynman: {
    zh: ["我的解释", "追问与例子", "新情境", "再次解释"],
    en: [
      "My explanation",
      "Questions & examples",
      "New context",
      "Explain again",
    ],
  },
  debate: {
    zh: ["还原观点", "支持与挑战", "回应与边界", "我的判断"],
    en: [
      "Clarify claim",
      "Support & challenge",
      "Response & limits",
      "My judgment",
    ],
  },
};
