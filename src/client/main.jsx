import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { Reader } from "./reader.jsx";
import { errors, localizeError } from "./api.js";
import { Traces, Settings, ModalContent } from "./forms.jsx";
const pairs = {
  title: ["AI 书房", "AI reading room"],
  tagline: [
    "与 AI 一起读书、思考，让阅读所得融入生活。",
    "Explore books, reflect on ideas, and learn with AI.",
  ],
  library: ["书库", "Library"],
  traces: ["我的痕迹", "My notes & history"],
  settings: ["设置与备份", "Settings & backup"],
  import: ["导入书籍", "Import books"],
  empty: [
    "从一本书开始，留下自己的思考",
    "Start with a book. Keep your own thoughts.",
  ],
  hint: [
    "支持 EPUB、PDF、TXT、Markdown；原书保存在本地。",
    "EPUB, PDF, TXT and Markdown. Originals stay local.",
  ],
  loading: ["正在读取…", "Loading…"],
  retry: ["重试", "Retry"],
  back: ["返回书库", "Back to library"],
  save: ["保存", "Save"],
  cancel: ["取消", "Cancel"],
  close: ["关闭", "Close"],
  saved: ["已保存", "Saved"],
  working: ["处理中…", "Working…"],
  error: ["操作失败", "Operation failed"],
  search: ["搜索书名、作者、标签", "Search title, author or tags"],
  all: ["全部", "All"],
  want: ["想读", "To read"],
  reading: ["在读", "Reading"],
  paused: ["暂放", "Paused"],
  finished: ["读完", "Finished"],
  unknownAuthor: ["作者未填写", "No author specified"],
  continue: ["继续阅读", "Continue reading"],
  notes: ["笔记", "Notes"],
  history: ["历程", "History"],
  spirit: ["书灵", "Book Spirit"],
  contents: ["目录", "Contents"],
  prev: ["上一章 / 页", "Previous"],
  next: ["下一章 / 页", "Next"],
  selectHint: [
    "选择正文，可划线、写感悟、记疑问或问书灵。",
    "Select text to highlight, reflect, ask a question or discuss.",
  ],
  highlight: ["划线", "Highlight"],
  reflection: ["感悟", "Reflection"],
  question: ["疑问", "Question"],
  note: ["长笔记", "Note"],
  ai: ["AI 内容", "AI content"],
  ask: ["问书灵", "Ask Book Spirit"],
  newNote: ["记一条笔记", "Write a note"],
  bodyHint: [
    "写下自己的理解、感受或仍未想清楚的地方…",
    "Write your understanding, feelings or unresolved questions…",
  ],
  noNotes: ["还没有学习记录", "No learning records yet"],
  trash: ["回收站", "Trash"],
  remove: ["移入回收站", "Move to trash"],
  restore: ["恢复", "Restore"],
  edit: ["编辑", "Edit"],
  versions: ["修订历史", "Revision history"],
  source: ["回到原文", "Go to source"],
  original: ["原文", "Source"],
  myRecord: ["我的记录", "My record"],
  aiRecord: ["AI 来源", "AI origin"],
  export: ["导出 Markdown", "Export Markdown"],
  free: ["自由讨论", "Open discussion"],
  hunt: ["狩猎法 · 带问题读", "Question-led reading"],
  feynman: ["费曼法 · 讲给书灵听", "Teach-back"],
  debate: ["辩论法 · 检验观点", "Perspective debate"],
  goal: ["这次希望想清楚什么？", "What would you like to understand?"],
  newExercise: ["开始新讨论 / 练习", "Start a discussion / exercise"],
  create: ["开始", "Start"],
  active: ["进行中", "Active"],
  completed: ["已回顾", "Completed"],
  pause: ["暂停练习", "Pause"],
  resume: ["继续练习", "Resume"],
  finish: ["标记已回顾", "Mark reviewed"],
  summarize: ["请书灵整理回顾", "Ask for a recap"],
  recapRequest: [
    "请根据本次讨论整理回顾：我已展示的理解、发生的修正、仍未解决的问题和对应原文。请区分我的观点与你的建议，不替我宣布完全掌握。",
    "Please recap this discussion: understanding I have demonstrated, revisions, unresolved questions, and source references. Distinguish my views from your suggestions; do not declare complete mastery.",
  ],
  stage: ["当前阶段", "Current stage"],
  send: ["发送", "Send"],
  stop: ["停止回复", "Stop"],
  message: ["和书灵说说你的想法…", "Share your thoughts with Book Spirit…"],
  contextHint: [
    "会发送你的消息、当前片段或章节摘录。书灵可以检索本书；不读取其他书籍。",
    "Your message and a current passage or chapter excerpt are sent to your DSH model. Book Spirit can search this book only.",
  ],
  pausedHint: [
    "练习已暂停或结束，继续后可发送消息。",
    "Resume the exercise to send messages.",
  ],
  saveReply: ["收进笔记", "Save to notes"],
  model: ["书灵使用的模型", "Book Spirit model"],
  defaultModel: ["跟随 DSH 默认模型", "Use DSH default"],
  replyLanguage: ["书灵回复语言", "Reply language"],
  auto: ["跟随提问语言", "Follow the question"],
  fontSize: ["正文字号", "Text size"],
  lineHeight: ["行距", "Line spacing"],
  pageWidth: ["正文宽度", "Reading width"],
  backup: ["下载学习资产备份", "Back up learning assets"],
  fullBackup: ["下载含原书备份", "Back up with original books"],
  restoreBackup: ["恢复备份", "Restore a backup"],
  backupHint: [
    "备份包含笔记、练习、可见讨论与设置；不含模型凭据和完整 DSH 会话运行状态。恢复前自动留存当前快照。",
    "Backups include notes, exercises, visible discussions and settings, without model credentials or full DSH session state. Current data is snapshotted before restore.",
  ],
  restoreWarning: [
    "恢复将替换当前书房的数据，原状态会先备份。请核对下方数量。",
    "Restore replaces current reading-room data after taking a snapshot. Review the counts below.",
  ],
  confirmRestore: ["确认恢复", "Restore now"],
  books: ["本书", "books"],
  records: ["条记录", "records"],
  exercises: ["次练习", "exercises"],
  conflicts: ["个重复书籍 ID", "matching book IDs"],
  path: ["本地文件 / 目录路径", "Local file / folder path"],
  scan: ["扫描目录", "Scan folder"],
  importPath: ["导入文件路径", "Import file path"],
  chooseFiles: ["选择文件", "Choose files"],
  chooseFolder: ["选择文件夹", "Choose folder"],
  importSelected: ["导入所选", "Import selected"],
  directoryHint: [
    "目录扫描当前层级，确认清单后再导入。",
    "Scan this folder, then confirm the list before import.",
  ],
  encoding: ["TXT 编码", "TXT encoding"],
  duplicate: ["已在书库中", "Already in library"],
  pdfText: ["PDF 文字版", "PDF with text"],
  scanned: [
    "此 PDF 没有可用文字层，暂支持查看原版和书签。OCR 在后续版本提供。",
    "No usable text layer. View the original PDF and add bookmarks. OCR is planned.",
  ],
  textMode: ["文字视图", "Text view"],
  pageMode: ["原版视图", "Original pages"],
  bookmark: ["记住这一页", "Bookmark this page"],
  pdfLabel: ["文件页", "File page"],
  metadata: ["书籍信息", "Book details"],
  bookTitle: ["书名", "Title"],
  author: ["作者", "Author"],
  tags: ["标签（逗号分隔）", "Tags (comma separated)"],
  status: ["阅读状态", "Reading status"],
  newPass: ["开启新一轮阅读", "Start a new reading pass"],
  newPassHint: [
    "保留上一轮的位置与全部笔记，重新开始阅读。",
    "Keep previous progress and all notes, then start again.",
  ],
  noExercise: [
    "从自由讨论开始，或选择一种读书方法。",
    "Start an open discussion or choose a reading method.",
  ],
  viewExercise: ["打开讨论", "Open discussion"],
  goalRequired: ["请先写下目标或问题", "Enter a goal or question first"],
  scope: ["参考范围", "Source scope"],
  noSelection: [
    "当前章节摘录（最多 12000 字符）",
    "Current chapter excerpt (up to 12,000 characters)",
  ],
  selection: ["已选原文与前后文", "Selected passage and nearby text"],
  readMethod: ["方法说明", "About this method"],
  huntDesc: [
    "带着问题建立阅读路线，寻找前置知识和反例，再联系自己的生活。",
    "Build a reading route around a question, including prerequisites and counterexamples, then connect it to your life.",
  ],
  feynmanDesc: [
    "先用自己的话解释，再通过例子、反例和新情境检验理解。",
    "Explain in your own words, then test examples, counterexamples and new situations.",
  ],
  debateDesc: [
    "先准确还原观点，再比较依据、挑战和适用条件，形成自己的判断。",
    "Clarify the strongest argument, compare evidence and challenges, then form your own judgment.",
  ],
  freeDesc: [
    "解释、翻译、讨论、记录感受，按你想要的方式聊。",
    "Explain, translate, discuss or reflect in your own way.",
  ],
  searchText: ["搜索原文", "Search book text"],
  noResults: ["没有找到匹配内容", "No matches found"],
  searchAll: ["搜索全部书籍原文", "Search all book text"],
  noteFilter: ["搜索记录与摘录", "Search notes and quotes"],
  localRoot: ["资产保存位置", "Asset folder"],
  privacy: [
    "AI 通过 DSH 中已配置的模型运行，相关内容会发送给你选择的模型服务。阅读、笔记与历史查看可离线使用。",
    "AI uses the model configured in DSH. Selected content is sent to that service. Reading, notes and saved history work offline.",
  ],
  unsupported: ["暂不支持此操作或格式", "Unsupported action or format"],
  conflict: [
    "内容已在其他窗口更新。你的输入仍保留，请刷新后比较。",
    "Changed in another window. Your draft is kept; reload and compare.",
  ],
  draft: ["输入草稿已留在本机", "Draft kept on this computer"],
  clearSelection: ["取消选段", "Clear passage"],
  view: ["查看", "View"],
  missingOriginal: [
    "原书或解析文件缺失，可恢复含原书备份或重新导入同一文件。",
    "Original or parsed file missing. Restore a full backup or reimport the same file.",
  ],
  update: ["刷新", "Refresh"],
  unknownDate: ["日期未知", "Unknown date"],
  noModel: [
    "请在 DSH 模型设置中配置可用模型",
    "Configure an available model in DSH",
  ],
  help: ["使用说明", "Help"],
  helpText: [
    "先导入书籍，点开封面开始阅读。选中文字可保存学习记录；右侧进入书灵并选择一种方法。记录与讨论都按日期保留，设置中可以导出备份。首版暂不包含 OCR、MOBI/AZW3、跨书主题和自动提醒。",
    "Import a book and open its cover to read. Select text to save a record. Use Book Spirit on the right and choose a method. Notes and discussions retain their dates. Export backups from Settings. OCR, MOBI/AZW3, cross-book topics and reminders are not included in this version.",
  ],
};
for (const [key, value] of Object.entries(errors))
  pairs["error." + key] = value;
const zh = Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, v[0]])),
  en = Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, v[1]]));
const API = "/api/ai-reading-room";
async function rpc(action, signal) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal,
  });
  const v = await r.json();
  if (!v.ok) throw new Error(v.error);
  return v.value;
}
const request = () => crypto.randomUUID();
function download(data, name, type) {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const stages = {
  free: [
    ["交流", "Discuss"],
    ["回顾", "Reflect"],
  ],
  hunt: [
    ["明确问题", "Question"],
    ["阅读路线", "Reading route"],
    ["联系自身", "Personal context"],
    ["我的理解", "My understanding"],
  ],
  feynman: [
    ["我的解释", "My explanation"],
    ["追问与例子", "Questions & examples"],
    ["新情境", "New context"],
    ["再次解释", "Explain again"],
  ],
  debate: [
    ["还原观点", "Clarify claim"],
    ["支持与挑战", "Support & challenge"],
    ["回应与边界", "Response & limits"],
    ["我的判断", "My judgment"],
  ],
};
function Icon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 11c-3.6-2-7.3-2.5-11-1v17c3.5-1.2 7.5-.7 11 1.5 3.5-2.2 7.5-2.7 11-1.5V14M18 11v17.5M10.5 16l4 1m-4 3 4 1m7-4 4-1m-4 5 4-1m1-15 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
    </svg>
  );
}
const css = `.arr{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:14px/1.55 system-ui,-apple-system,sans-serif}.arr *{box-sizing:border-box}.arr button,.arr input,.arr textarea,.arr select{font:inherit;color:inherit}.arr button{cursor:pointer;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:7px 12px}.arr button:hover{background:var(--dsw-alias-bg-layer-2)}.arr button:disabled{opacity:.5;cursor:default}.arr button.primary,.arr button[aria-selected=true]{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-brand-primary)}.arr button:focus-visible,.arr input:focus-visible,.arr textarea:focus-visible,.arr select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.arr input,.arr textarea,.arr select{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:8px;min-width:0}.arr textarea{width:100%;resize:vertical;min-height:90px}.arr h1{font-size:23px;margin:0;letter-spacing:.02em}.arr h2{font-size:18px;margin:0 0 12px}.arr h3{font-size:15px;margin:0 0 8px}.arr p{margin:8px 0}.arr .muted{color:var(--dsw-alias-label-secondary)}.arr .head{padding:18px 26px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0}.arr .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.arr .spread{justify-content:space-between}.arr .nav{margin-top:14px;gap:6px}.arr .nav button{border-color:transparent;background:none}.arr .nav button[aria-selected=true]{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.arr .grow{flex:1;min-width:0}.arr .scroll{overflow:auto;min-height:0;flex:1}.arr .page{padding:24px 30px}.arr .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:24px}.arr .toolbar input{min-width:240px;flex:1}.arr .shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(162px,1fr));gap:22px}.arr .book{border:0;text-align:left;padding:0;background:none;display:flex;flex-direction:column;align-items:stretch;gap:9px;overflow:hidden}.arr .cover{height:208px;border:1px solid var(--dsw-alias-border-l2);border-radius:3px 10px 10px 3px;background:var(--dsw-alias-bg-layer-1);display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;font-family:Georgia,'Songti SC',serif;font-size:21px;line-height:1.5;box-shadow:inset 5px 0 0 var(--dsw-alias-border-l1);overflow:hidden}.arr .cover img{width:100%;height:100%;object-fit:contain}.arr .bookTitle{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.arr .small{font-size:12px}.arr .pill{padding:2px 7px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-size:12px}.arr .empty{padding:80px 20px;text-align:center}.arr .banner{padding:10px 24px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);display:flex;justify-content:space-between;align-items:center}.arr .error{color:var(--dsw-alias-state-error-primary)}.arr .reader{flex:1;min-height:0;display:flex;overflow:hidden}.arr .toc{width:200px;min-width:150px;border-right:1px solid var(--dsw-alias-border-l1);padding:14px;overflow:auto}.arr .toc button{display:block;width:100%;text-align:left;background:none;border:0;margin:3px 0;font-size:13px}.arr .reading{flex:1;min-width:340px;display:flex;flex-direction:column;min-height:0}.arr .readbar{padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}.arr .body{padding:32px 34px;overflow:auto;flex:1;min-height:0;scroll-behavior:auto}.arr .prose{margin:0 auto;font-family:Georgia,'Songti SC','Noto Serif CJK SC',serif;overflow-wrap:break-word}.arr .prose p{margin:0 0 1em}.arr .prose img{max-width:100%;height:auto}.arr .prose table{border-collapse:collapse;max-width:100%;display:block;overflow:auto}.arr .prose td,.arr .prose th{border:1px solid var(--dsw-alias-border-l1);padding:8px}.arr .prose pre{white-space:pre-wrap;background:var(--dsw-alias-bg-layer-2);padding:14px}.arr .prose a{color:var(--dsw-alias-brand-primary)}.arr mark{background:var(--dsw-alias-bg-layer-2);color:inherit;text-decoration:underline;text-decoration-color:var(--dsw-alias-brand-primary);text-decoration-thickness:2px}.arr .side{width:365px;min-width:320px;max-width:48%;resize:horizontal;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0;overflow:hidden}.arr .sidetabs{padding:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}.arr .sidebody{padding:14px;overflow:auto;min-height:0;flex:1}.arr .card{padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);margin-bottom:12px;overflow-wrap:anywhere}.arr blockquote{margin:8px 0;padding:5px 10px;border-left:3px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary);white-space:pre-wrap}.arr .recordBody,.arr .messageBody{white-space:pre-wrap;overflow-wrap:anywhere}.arr .message{margin:12px 0;padding:12px;border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.arr .message.user{background:var(--dsw-alias-bg-layer-2)}.arr .compose{padding:12px;border-top:1px solid var(--dsw-alias-border-l1)}.arr .methodlist{display:grid;gap:10px}.arr .methodlist button{text-align:left;padding:16px}.arr .methodlist .muted{display:block;margin-top:6px}.arr .form{display:grid;gap:14px}.arr label{display:grid;gap:5px}.arr .modalShade{position:absolute;inset:0;z-index:30;background:var(--dsw-alias-bg-overlay);display:flex;align-items:center;justify-content:center;padding:30px}.arr .modal{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;max-width:760px;width:100%;max-height:90%;overflow:auto;padding:24px;box-shadow:0 12px 42px var(--dsw-alias-border-l2)}.arr .columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}.arr .settings{max-width:920px;margin:auto}.arr .selection{padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}.arr .selection blockquote{font-size:13px;max-height:90px;overflow:auto}.arr .pdfbox{position:relative;margin:0 auto;width:fit-content;background:var(--dsw-alias-bg-layer-1)}.arr .pdfbox canvas{display:block}.arr .pdftext{position:absolute;inset:0;overflow:hidden;opacity:1;line-height:1;text-align:initial;transform-origin:0 0}.arr .pdftext{--min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor)*var(--min-font-size));--min-font-size-inv:calc(1/var(--min-font-size));text-size-adjust:none}.arr .pdftext span,.arr .pdftext br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0}.arr .pdftext > :not(.markedContent),.arr .pdftext .markedContent span:not(.markedContent){z-index:1;--font-height:0;font-size:calc(var(--text-scale-factor)*var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}.arr .pdftext .markedContent{display:contents}.arr .pdftext ::selection{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}.arr .pdfmark{position:absolute;pointer-events:none;border:1px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}.arr .searchResults{max-height:240px;overflow:auto}.arr .link{color:var(--dsw-alias-brand-primary)}.arr .settings .card{padding:20px}.arr .footer{padding:8px 15px;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-secondary)}.arr .nowrap{white-space:nowrap}@media(max-width:1100px){.arr .toc{width:160px}.arr .side{width:330px}.arr .body{padding:24px}}
`;
export const inject = ["slots", "locale"];
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register("aiReadingRoom", { zh, en }));
  const t = ctx.locale.bind("aiReadingRoom");
  function App() {
    const locale = useSyncExternalStore(
      (cb) => ctx.locale.subscribe(cb),
      () => ctx.locale.getSnapshot(),
    );
    const lang = locale.active.startsWith("zh") ? "zh" : "en";
    const [data, setData] = useState(null),
      [error, setError] = useState(""),
      [busy, setBusy] = useState(false),
      [notice, setNotice] = useState(""),
      [tab, setTab] = useState("library"),
      [opened, setOpened] = useState(null),
      [modal, setModal] = useState(null),
      [query, setQuery] = useState(""),
      [filter, setFilter] = useState("all"),
      [allRecords, setAllRecords] = useState([]);
    const busyRef = useRef(false);
    async function refresh() {
      setData(await rpc({ action: "read" }));
    }
    useEffect(() => {
      refresh().catch((e) => setError(e.message));
    }, []);
    async function run(fn) {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      try {
        return await fn();
      } catch (e) {
        if (e.name !== "AbortError") setError(localizeError(e.message, t));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    }
    async function open(id) {
      await run(async () => {
        setOpened(await rpc({ action: "open", id }));
      });
    }
    const navigate = (key) => {
      setTab(key);
      setOpened(null);
      setQuery("");
      refresh().catch((e) => setError(e.message));
      if (key === "traces")
        rpc({ action: "records" })
          .then((v) => setAllRecords(v.items))
          .catch((e) => setError(e.message));
    };
    const date = (at) =>
      at
        ? new Date(at).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")
        : t("unknownDate");
    async function saveNote(payload) {
      await rpc({
        ...payload,
        action: "saveRecord",
        requestId: payload.requestId || request(),
      });
      setNotice(t("saved"));
      if (opened) setOpened(await rpc({ action: "open", id: opened.book.id }));
      if (tab === "traces")
        setAllRecords((await rpc({ action: "records" })).items);
      setModal(null);
    }
    function showNote(
      bookId,
      kind = "reflection",
      anchor = null,
      body = "",
      origin = "user",
      discussionId = "",
    ) {
      setModal({
        kind: "note",
        bookId,
        type: kind,
        anchor,
        body,
        origin,
        discussionId,
      });
    }
    const list = (data?.books || [])
      .filter((b) =>
        filter === "trash"
          ? b.deletedAt
          : !b.deletedAt && (filter === "all" || b.status === filter),
      )
      .filter((b) =>
        (b.title + " " + b.author + " " + b.tags.join(" "))
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        (b.lastOpenedAt || b.createdAt).localeCompare(
          a.lastOpenedAt || a.createdAt,
        ),
      );
    return (
      <div className="arr" style={{ position: "relative" }}>
        <style>{css}</style>
        <header className="head">
          <div className="row spread">
            <div className="row">
              <Icon size={29} />
              <div>
                <h1>{t("title")}</h1>
                <div className="muted small">{t("tagline")}</div>
              </div>
            </div>
            <div className="row">
              <button onClick={() => setModal({ kind: "help" })}>
                {t("help")}
              </button>
              <button onClick={() => setModal({ kind: "import" })}>
                {t("import")}
              </button>
            </div>
          </div>
          <nav className="row nav">
            {["library", "traces", "settings"].map((key) => (
              <button
                key={key}
                aria-selected={tab === key && !opened}
                onClick={() => navigate(key)}
              >
                {t(key)}
              </button>
            ))}
            {opened && <span className="pill">{opened.book.title}</span>}
          </nav>
        </header>
        {(error || notice || busy) && (
          <div className={"banner " + (error ? "error" : "")} role="status">
            <span>{error || (busy ? t("working") : notice)}</span>
            <button
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              ×
            </button>
          </div>
        )}
        {!data ? (
          <div className="empty">
            {t("loading")}{" "}
            <button onClick={() => run(refresh)}>{t("retry")}</button>
          </div>
        ) : opened ? (
          <Reader
            key={opened.book.id}
            info={opened}
            setInfo={setOpened}
            settings={data.settings}
            t={t}
            lang={lang}
            date={date}
            run={run}
            showNote={showNote}
            busy={busy}
            back={() => {
              setOpened(null);
              refresh().catch((e) => setError(e.message));
            }}
            setModal={setModal}
          />
        ) : tab === "library" ? (
          <div className="scroll page">
            <div className="toolbar">
              <input
                aria-label={t("search")}
                placeholder={t("search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label={t("status")}
              >
                {["all", "want", "reading", "paused", "finished", "trash"].map(
                  (k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ),
                )}
              </select>
              <button onClick={() => setModal({ kind: "search", bookId: "" })}>
                {t("searchAll")}
              </button>
              <button onClick={() => run(refresh)}>{t("update")}</button>
            </div>
            {!list.length ? (
              <div className="empty">
                <Icon size={50} />
                <h2>{t("empty")}</h2>
                <p className="muted">{t("hint")}</p>
                <button
                  className="primary"
                  onClick={() => setModal({ kind: "import" })}
                >
                  {t("import")}
                </button>
              </div>
            ) : (
              <div className="shelf">
                {list.map((b) => (
                  <div key={b.id}>
                    <button
                      className="book"
                      style={{ width: "100%" }}
                      onClick={() =>
                        b.deletedAt
                          ? run(async () => {
                              await rpc({
                                action: "trashBook",
                                id: b.id,
                                revision: b.revision,
                                restore: true,
                                requestId: request(),
                              });
                              await refresh();
                            })
                          : open(b.id)
                      }
                    >
                      <div className="cover">
                        {b.hasCover ? (
                          <img
                            loading="lazy"
                            src={API + "/cover?id=" + b.id}
                            alt={b.title}
                          />
                        ) : (
                          <span>{b.title}</span>
                        )}
                      </div>
                      <span className="bookTitle">{b.title}</span>
                      <span className="muted small">
                        {b.author || t("unknownAuthor")}
                      </span>
                      <span className="row small">
                        <span className="pill">{b.format.toUpperCase()}</span>
                        <span>{b.deletedAt ? t("restore") : t(b.status)}</span>
                      </span>
                      {b.lastOpenedAt && (
                        <span className="muted small">
                          {date(b.lastOpenedAt)}
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === "traces" ? (
          <Traces
            items={allRecords}
            data={data}
            query={query}
            setQuery={setQuery}
            t={t}
            date={date}
            open={open}
            run={run}
            refresh={async () =>
              setAllRecords((await rpc({ action: "records" })).items)
            }
            setModal={setModal}
          />
        ) : (
          <Settings
            data={data}
            refresh={refresh}
            t={t}
            run={run}
            setModal={setModal}
          />
        )}
        {modal && (
          <Modal
            onClose={() => setModal(null)}
            title={t(
              modal.kind === "note"
                ? "newNote"
                : modal.kind === "import"
                  ? "import"
                  : modal.kind === "search"
                    ? "searchText"
                    : modal.kind === "meta"
                      ? "metadata"
                      : modal.kind === "restore"
                        ? "restoreBackup"
                        : "help",
            )}
          >
            <ModalContent
              modal={modal}
              t={t}
              lang={lang}
              run={run}
              busy={busy}
              close={() => setModal(null)}
              refresh={refresh}
              showNote={showNote}
              saveNote={saveNote}
              date={date}
              open={open}
              setInfo={setOpened}
              data={data}
            />
          </Modal>
        )}
      </div>
    );
  }
  function Modal({ children, onClose, title }) {
    const ref = useRef(null),
      previous = useRef(document.activeElement);
    useEffect(() => {
      const el = ref.current;
      el.querySelector("button,input,textarea,select")?.focus();
      function key(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        if (e.key === "Tab") {
          const nodes = [
            ...el.querySelectorAll("button,input,textarea,select,a[href]"),
          ].filter((n) => !n.disabled);
          if (!nodes.length) return;
          const first = nodes[0],
            last = nodes.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      el.addEventListener("keydown", key);
      return () => {
        el.removeEventListener("keydown", key);
        previous.current?.focus();
      };
    }, []);
    return (
      <div className="modalShade">
        <section
          className="modal"
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="row spread" style={{ marginBottom: 18 }}>
            <h2>{title}</h2>
            <button onClick={onClose} aria-label={t("close")}>
              ×
            </button>
          </div>
          {children}
        </section>
      </div>
    );
  }
  class Boundary extends React.Component {
    constructor(p) {
      super(p);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    render() {
      return this.state.error ? (
        <div style={{ padding: 30 }}>
          <h2>{t("error")}</h2>
          <p>{String(this.state.error.message)}</p>
          <button onClick={() => this.setState({ error: null })}>
            {t("retry")}
          </button>
        </div>
      ) : (
        <App />
      );
    }
  }
  ctx.slots.inject("sidebar.panellist", () =>
    ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: "ai-reading-room",
        order: 9,
        label: () => t("title"),
      },
      Icon,
    ),
  );
  ctx.slots.inject("main", () =>
    ctx.slots.register({ name: "main", key: "ai-reading-room" }, Boundary),
  );
}
