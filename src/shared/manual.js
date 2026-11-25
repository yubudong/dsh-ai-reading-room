import { SHORTCUTS, shortcutConfig, keyLabel } from "./shortcuts.js";
export const MANUAL_VERSION = "0.5.3";
export const MANUAL = [
  {
    id: "start",
    title: { zh: "三分钟开始阅读", en: "Start reading in three minutes" },
    body: {
      zh: "从顶部“导入书籍”加入一本书。导入完成点击“开始阅读”；批量导入点击“查看已导入书籍”。没有准备图书时，可点击帮助中心的“体验示例”。选中正文后，可以划线、记感悟、记疑问或问书虫。也可以直接在右侧输入消息，不必先填写目标。首次提示可跳过，之后从“使用说明”重新打开。",
      en: "Import a book from the header. Click Start reading after a single import, or View imported books after a batch. Use Try a sample when no book is ready. Select text to highlight, reflect, save a question or ask Bookworm. You can also type directly, without a goal form. Onboarding can be skipped and reopened from Help.",
    },
  },
  {
    id: "import",
    title: {
      zh: "导入文件、文件夹与关联目录",
      en: "Files, folders and linked libraries",
    },
    body: {
      zh: "导入文件会复制一份到主书库，不修改下载的原文件。批量导入文件夹先扫描、勾选，再复制所选图书；可勾选“包含子文件夹”。“关联现有文件夹”保留原位置、不重复复制，保存索引；点击“重新扫描”发现新增图书，也可主动开启“进入书房时检查”。扫描不会跟随符号链接，不支持的格式会跳过。导入完成区分成功、重复、失败，并提供开始阅读、回到书库和继续导入。TXT 编码在高级选项中。",
      en: "Import copies a file into the managed library without changing the download. Batch folder import scans, lets you select files and copies them; include subfolders optionally. Linking keeps originals in their folder without another copy. Rescan to discover new books, or opt into checking when the room opens. Symlinks are not followed. Completion separates success, duplicate and failed files and offers clear next actions. TXT encoding is under Advanced.",
    },
  },
  {
    id: "storage",
    title: {
      zh: "书库位置、迁移与文件失联",
      en: "Library location, migration and missing files",
    },
    body: {
      zh: "在“设置与备份 → 书库与文件”查看主书库和关联目录。普通 EPUB/PDF 等原书放在主书库；解析缓存、结构化学习记录与原生会话由 DSH 数据目录管理。更改主书库位置时，先复制并校验原书，全部成功后切换；旧文件保留，不自动删除。学习记录的书籍 ID 和引用保持不变。可把电子书放进主书库后点击扫描入库。关联目录被移动时，原有笔记仍保留；可重新关联目录，或在书籍信息中重新定位同一内容的原文件。",
      en: "Settings & backup → Library & files shows the managed location and linked folders. Originals live in the library; parsed caches, learning records and native sessions are managed under DSH data. Changing location copies and verifies originals before switching; old files are retained. Book IDs and citations stay stable. Place ebooks into the library and scan to add them. If a linked file moves, notes remain. Relink its directory or locate the same original from Book details.",
    },
  },
  {
    id: "reading",
    title: { zh: "阅读、目录与搜索", en: "Reading, contents and search" },
    body: {
      zh: "左侧目录读取 EPUB 的正式导航，支持层级和段落跳转。点击‘专注阅读’或在正文按 F，可隐藏书房页头和重复工具栏；搜索、导出、设置和回顾都在‘更多’中。保存反馈为短暂浮动提示，不挤动正文；失败提示提供重试。新进度按正在看的文字保存，改变字号或左右栏宽度后尽量保持同一句话；旧进度继续兼容。点击原文引用或记录后，可用‘返回刚才位置’或正文中的 R 返回。拖动目录右边缘可调整宽度，设置会在本机记住；双击或 Enter 恢复默认宽度，分隔线获得焦点后用左右键微调。旧书可在“书籍信息”中修复目录；修复保留正文及原有批注位置，无法安全匹配时显示提示。连续模式使用空格或 PageDown 翻一屏，上下箭头小幅滚动；PDF 到当前页边缘后可进入相邻页。上一章/下一章用于明确跨章节跳转。PDF 原版可缩放，也可切换文字视图。顶部“搜索原文”检索本书，结果可跳转原文。长书名显示省略，悬停可看全文。",
      en: "Contents use EPUB navigation, including nesting and fragment targets. Focus (or F with body focus) hides the page header and repeated tools; search, export, settings and reviews remain in More. Save feedback uses a brief overlay; failures offer retry. New progress uses text anchors across font and column changes, while old pixel progress remains compatible. Return to reading (or R with body focus) restores the place before a reference jump. Drag the right edge of the contents panel to resize it; the width is remembered on this device. Double-click or Enter resets it; arrow keys adjust the focused separator. Repair contents in Book details for older imports; body text and annotation positions are preserved, with a warning when a safe match is unavailable. Space/PageDown advances a screen in scrolling mode; arrows scroll in small steps. At a PDF page edge, navigation can move to the adjacent page. Previous/next chapter explicitly skips chapters. PDFs have original and text views. Search book text from the header and jump from results. Hover truncated titles to read them.",
    },
  },
  {
    id: "chat",
    title: {
      zh: "与书虫交流、选模型和保存回答",
      en: "Talk with Bookworm, choose a model and save replies",
    },
    body: {
      zh: "选中一段原文后点“问书虫”，或在输入框直接提问。输入框上方可选简短、适中或深入，偏好作用于后续消息；用户明确要求的深浅优先。最新回复下方可点举个例子、简单一点或展开论证，跟进上一条回答的原文范围，不会清空尚未发送的问题。回复的原文按钮优先定位已核对的具体片段；旧讨论可能仍回到章节。输入框底部选择当前讨论模型；Enter 发送，Shift+Enter 换行，中文输入法组合输入不会误发。拖动侧栏左边缘调宽，双击恢复默认；右上角可展开、恢复或收起。历史入口可继续旧讨论，新建按钮开启另一段。助手回答下方“收进笔记”生成可审阅的笔记，保留 AI 来源。回复时可以停止。参考范围显示本次选段或章节摘录，远程模型会收到这些相关材料，不默认读取整个书库。",
      en: "Select a passage and Ask Bookworm, or type directly. Choose Brief, Balanced or In depth for later replies; explicit requests take priority. Follow-ups under the latest reply ask for examples, simplicity or deeper reasoning while keeping the previous source scope and your draft. Source buttons favor verified passages; older discussions may still link to a chapter. Choose the discussion model inside the composer. Enter sends, Shift+Enter adds a line; IME composition is protected. Drag the left panel edge to resize, double-click to reset, and use header controls to expand or close it. History resumes a discussion; New starts another. Save to notes opens a reviewable AI-origin note. Stop a reply anytime. Source scope shows selected text or a chapter excerpt sent to the selected model, not the entire library.",
    },
  },
  {
    id: "methods",
    title: {
      zh: "读书方法与完整提示词",
      en: "Reading methods and full prompts",
    },
    body: {
      zh: "右侧提供‘自由聊’和‘读书方法论’两个入口。自由聊用于解释、翻译和感悟。点击读书方法论，在列表中搜索内置或个人方法，收藏和最近使用的方法优先显示。每种方法首次使用都会打开说明弹窗，展示适用场景、使用步骤和可编辑的完整提示词。可以勾选‘以后使用这个方法时，不再自动弹出’，偏好跨书籍保留；之后仍可通过当前方法旁的‘查看与编辑’重新打开。选择方法不会调用模型或清空问题，点击本次使用只回到聊天。‘本次使用’的提示词编辑只影响下一条消息；保存为个人版本或另存为新方法可反复使用。提示词变量和本轮参考内容可展开核对，默认使用紧凑状态栏，也可固定展开完整提示词。每轮保存实际提示词版本，切换方法只影响后续消息。没有明确问题也能开始。",
      en: "Choose Chat or Reading methodologies in the sidebar. Search built-in and personal methods; favorites and recent methods appear first. First use of each method opens a dialog with scenarios, steps and an editable full prompt. Do not open automatically is remembered per method across books; View & edit always reopens it. Selecting or applying sends no model request and keeps your question draft. Use for this turn affects the next message only; save a personal version or new method for reuse. Inspect expanded instructions and references, or optionally pin the full prompt. Each turn retains its actual prompt snapshot. Switching affects later messages; no predefined question is required.",
    },
  },
  {
    id: "custom",
    title: { zh: "创建和管理我的方法", en: "Create and manage your methods" },
    body: {
      zh: "进入顶部‘读书方法论’管理方法，名称和完整提示词是创建时的最低要求，简介、适用场景和使用步骤可选。内置方法可以直接编辑保存为个人版本，并可恢复内置默认；个人方法支持编辑、复制、排序、收藏、停用和重新启用。修订历史可查看旧提示词，并按旧版本继续编辑。变量 {{book}}、{{author}}、{{chapter}}、{{selection}} 会替换成当前阅读内容，{{notes}} 只有明确勾选使用本书笔记时才带入。可以让书虫建议名称与说明草稿，再由你保存。JSON 导出包含个人方法及内置方法的个人版本，导入后作为独立方法保存；完整书房备份保留版本历史及首次提示偏好。设置可恢复全部方法的首次说明。旧讨论保留当时的提示词，不随方法修改而改写。",
      en: "Open Reading methodologies in the main navigation. A name and full prompt are required; descriptions, scenarios and usage steps are optional. Edit a built-in as a personal version and restore its default anytime. Edit, copy, order, favorite, disable/re-enable and inspect earlier prompt revisions. Variables {{book}}, {{author}}, {{chapter}} and {{selection}} use the current context; {{notes}} requires an explicit opt-in. Bookworm can suggest metadata drafts for your review. JSON exports include personal versions and imports create independent methods. Full backups retain histories and introduction preferences. Settings can reset all first-use introductions. Earlier discussions keep the prompts actually used.",
    },
  },
  {
    id: "annotations",
    title: {
      zh: "五色标注、下划线与右键操作",
      en: "Five-color highlights, underlines and context actions",
    },
    body: {
      zh: "普通选字和单击已有标注不会弹出标注工具。只有右键选区或已有标注才显示菜单，可选择黄、绿、蓝、粉、紫高亮或独立下划线，直接保存而不用打开笔记表单。右键选区或已有标注，可以改色、添加或编辑笔记、移除标注、问书虫、翻译、搜索本书或拷贝。普通位置保留系统菜单；Esc 或点击空白处关闭浮层。每本书分别保留最近50步阅读区标注操作，支持新增、改色、下划线和移除的撤销与重做。Mac 使用 ⌘Z / ⌘⇧Z，Windows 使用 Ctrl+Z / Ctrl+Shift+Z，也可点击阅读工具栏的撤销/重做按钮或右键菜单项。聊天、笔记和其他输入框继续使用自身的文字撤销。撤销只恢复标注外观和回收站状态，不覆盖后来编辑的笔记；若外观在其他入口发生变化，旧操作会停止重放，避免撤错。恢复备份后清空旧撤销栈。改色保留原有笔记和原文依据；移除带笔记的标注只去掉视觉样式，保留笔记。没有正文笔记的纯标注移入可恢复的回收站。旧标注继续按下划线显示，可通过右键改色。EPUB、文字视图和有可选文字的 PDF 均支持，扫描 PDF 不提供 OCR。翻译选段会预填书虫问题，由你决定是否发送。",
      en: "Selecting text or clicking a mark opens no annotation tools. Only right-clicking the selection or an existing mark opens the menu, with yellow, green, blue, pink and purple highlights or an independent underline, saved directly. Right-click a selection or existing mark to recolor, add/edit a note, remove the mark, ask Bookworm, translate, search this book or copy. Ordinary positions keep the system menu. Escape or clicking away closes the popover. Each book keeps its latest 50 reader annotation actions for undo/redo, including creation, color, underline and removal. Use Cmd+Z / Cmd+Shift+Z on Mac or Ctrl+Z / Ctrl+Shift+Z on Windows, or the toolbar/context menu buttons. Inputs retain native text undo. Only appearance and trash state are restored; later note edits are kept. Changes from other entry points invalidate older commands rather than overwriting them. Restoring a backup clears command history. Recoloring keeps notes and source anchors. Removing a mark with note text keeps the note; pure marks go to recoverable Trash. Legacy marks retain an underline fallback and can be recolored. EPUB, text views and selectable PDF text are supported; OCR is not included. Translate prefills a question for you to send.",
    },
  },
  {
    id: "notes",
    title: {
      zh: "学习记录、删除与备份",
      en: "Learning records, trash and backups",
    },
    body: {
      zh: "划线、感悟、疑问和长笔记保存日期及原文依据。修订保留历史，删除进入回收站，不删除原书。“我的痕迹”可跨书检索记录，按书籍、颜色、记录类型、创建日期筛选，也可只看没有感想的标注或尚未解决的疑问。每条有出处的记录可以直接回原文；疑问可标记已有理解或重新打开。可勾选并导出当前选中的记录，日期按当前设备时区筛选。颜色可在设置中自定义名称，默认不强制赋予学习含义。“导出 Markdown”把本书笔记和讨论带走。“设置与备份”可下载学习资产备份，或选择含原书的完整书房备份。恢复前展示数量、保留当前快照，再替换记录。原生会话完整运行状态与模型凭据不在插件备份中；缺失的原生会话会以可见历史重新开始。",
      en: "Highlights, reflections, questions and long notes retain dates and sources. Edits keep history; deletion goes to Trash without deleting originals. My notes & history searches across books and filters by book, color, type, creation date, unwritten marks or open questions. Jump directly to sources, mark questions understood or reopen them, and export only selected records. Date filters use the device time zone. Color names can be customized without imposing meanings. Markdown export carries notes and conversations. Settings & backup downloads learning assets or includes originals. Restore previews counts and snapshots current state before replacing records. Full native session runtime and model credentials are not in plugin backups; visible history can start a fresh native session.",
    },
  },
  {
    id: "review",
    title: {
      zh: "本次阅读回顾与生活尝试草稿",
      en: "Session reviews and optional life experiments",
    },
    body: {
      zh: "从阅读区‘更多 → 本次阅读回顾’或书虫标题区的回顾按钮打开。基础草稿来自本次时间范围内保存的记录和讨论中的用户原话，用户问题不等同于已经理解。取材范围可以展开检查，包括用户发言、保存记录、AI 历史回答和当前章节摘录；较长或较多材料会截取并提示限制。可以编辑草稿，也可主动请书虫整理。生成结果单独显示，只有点击插入才进入草稿，不覆盖正在写的内容。范围可以手动调整并重新开始，替换前的草稿可恢复。保存后进入我的痕迹，区分用户记录和 AI 参与内容。可选小行动只保存为文字草稿，不自动创建待办、日程或提醒。关闭生成窗口后，已发起的回复仍可在讨论历史查看。",
      en: "Open More → Reading review or the review button in Bookworm. A base draft uses saved records and reader messages within the session range; a question is not proof of understanding. Inspect the materials, including reader words, saved records, AI replies and a chapter excerpt. Long or numerous inputs are bounded and limitations shown. Edit your draft or explicitly ask Bookworm to organize suggestions. AI output is separate and inserted only by your choice, never overwriting ongoing edits. Adjust the source range and restart with an option to restore the previous draft. Save to My notes & history with user and AI origins distinguished. Optional experiments stay as text; no task, schedule or reminder is created. Started replies remain available in discussion history after closing the dialog.",
    },
  },
  {
    id: "keys",
    title: { zh: "阅读快捷键与生效范围", en: "Reading shortcuts and focus" },
    body: {
      zh: "快捷键只在阅读正文获得焦点时生效。点击正文后使用空格、方向键和 PageUp/PageDown 阅读；聊天框、笔记编辑器和搜索输入框保持正常输入。目录按钮和弹窗有自己的键盘行为。Tab 切换控件焦点，Esc 关闭当前浮层。快捷键速查展示本机实际配置，可修改、停用或恢复默认；系统和 DSH 已保留的组合不覆盖。若快捷键被系统或宿主先处理，请使用对应按钮或换一个键位。",
      en: "Shortcuts apply when the reading body is focused. Click the body to use Space, arrows and PageUp/PageDown. Chat, note editors and search fields keep normal text input. Contents and modals have their own key behavior. Tab moves focus; Escape closes overlays. The shortcut reference shows effective device-local bindings and supports customization, disabling and reset. Reserved system/DSH combinations are not overridden. If the host consumes a binding first, use its button or choose another.",
    },
  },
  {
    id: "faq",
    title: {
      zh: "常见问题与当前限制",
      en: "Troubleshooting and current limits",
    },
    body: {
      zh: "导入后点击开始阅读；重复项可以打开已有书籍。目录重复时使用修复目录。关联原书找不到时重新定位，不要删除笔记。模型不可用时到 DSH 模型设置检查配置，再刷新模型列表。快捷键无效先确认焦点是否在正文、是否有弹窗、是否被系统占用。首版支持 EPUB、PDF、TXT、Markdown；扫描 PDF 可看原版，OCR、MOBI/AZW3、云同步和独立生活实践看板尚未提供。单本上限64 MiB，PDF上限2500页，ZIP解压总量192 MiB。离线阅读笔记可用，AI 需要可用模型。",
      en: "After import, choose Start reading. Open an existing book for duplicates. Repair repeated contents labels. Relocate missing linked originals rather than deleting notes. Check model configuration in DSH and refresh the model list. For shortcuts, check body focus, overlays and system conflicts. Supported formats are EPUB, PDF, TXT and Markdown; scanned PDF viewing works, but OCR, MOBI/AZW3, cloud sync and a separate life-practice board are not included. Limits: 64 MiB per book, 2,500 PDF pages, 192 MiB uncompressed ZIP. Reading and notes work offline; AI needs an available model.",
    },
  },
];
export function manualSearch(query = "", language = "zh") {
  const q = query
      .toLowerCase()
      .replace(/怎么|如何|怎样|请问|how to/g, "")
      .trim(),
    terms = q.split(/\s+/).filter(Boolean);
  const aliases = {
    import: [
      "导入目录",
      "导入书籍",
      "导入文件夹",
      "文件夹",
      "import",
      "folder",
    ],
    storage: ["书库位置", "工作目录", "存放位置", "迁移", "移动书库"],
    methods: ["费曼", "狩猎", "辩论", "提示词", "method", "prompt"],
    keys: ["快捷方式", "快捷键", "键位", "keyboard", "shortcut"],
    custom: ["我的方法", "自定义方法"],
    chat: ["切换模型", "聊天", "model"],
    notes: ["备份", "导出", "恢复"],
  };
  return MANUAL.filter((x) => {
    const text = (
      x.title[language] +
      " " +
      x.body[language] +
      " " +
      x.id
    ).toLowerCase();
    return (
      !q ||
      terms.every((term) => text.includes(term)) ||
      (aliases[x.id] || []).some((term) => q.includes(term))
    );
  });
}
export function manualContext(
  query,
  language = "zh",
  overrides = {},
  mac = false,
) {
  const hits = manualSearch(query, language);
  const articles = hits.length ? hits : MANUAL;
  return {
    version: MANUAL_VERSION,
    rule: "Answer the software usage question directly. Do not apply a reading exercise, invent controls or claim unavailable features. Cite the matching manual section IDs. The user decides whether to navigate or save.",
    articles: articles.map((x) => ({
      id: x.id,
      title: x.title[language],
      text: x.body[language],
    })),
    shortcuts: shortcutConfig(overrides).map((x) => ({
      action: x[language],
      keys: x.keys.map((k) => keyLabel(k, mac)),
    })),
  };
}
export function isUsageQuestion(text) {
  return /^(使用帮助|help)|导入(?:书籍|文件|目录|图书|电子书)|关联(?:目录|文件夹)|书库(?:位置|目录)|快捷键|切换模型|选择模型|模型列表|配置模型|使用说明|插件怎么用|(?:how|where).*(?:import|backup|shortcut|plugin|keyboard|folder)/i.test(
    text,
  );
}
