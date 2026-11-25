# AI 书房 / AI Reading Room 0.5.2

本版汇总从初始 0.1.0 预览以来的阅读、书虫、方法论、标注和学习记录更新。

## 主要更新

- 阅读伙伴更名为书虫 / Bookworm，提供原创新形象、自由讨论与读书方法论双入口，无需先填写阅读目标。
- 可预览和编辑完整提示词，保存个人方法与内置方法的个人版本，支持收藏、排序和历史快照。
- 专注阅读、左右栏宽度调整、文本锚点进度恢复、精确原文引用和跳转后返回。
- 五色高亮与独立下划线仅通过右键选区/已有标注打开；普通选字和单击不再弹出色板。
- 按书籍分别保存最近50步标注撤销/重做。Mac：⌘Z/⌘⇧Z；Windows：Ctrl+Z/Ctrl+Shift+Z。输入框继续使用自身的文字撤销。
- 撤销保护后来写入的笔记正文；过时或并发改变的操作不会覆盖当前标注。重复请求与存储失败不额外推进历史。
- 我的痕迹支持书籍、颜色、类型、日期、未写感想和待解疑问筛选；可直接回原文、调整疑问状态、导出选中记录。
- 简短/适中/深入回复偏好；主动生成、可编辑的阅读回顾，区分用户表达与 AI 建议，可选生活尝试只保存为草稿，不创建任务或提醒。
- 批量导入、关联目录、可更改的主书库位置、EPUB 导航修复、双语说明书与备份兼容。

## 安装

在 DSH「插件 → 添加插件」中使用：

```text
https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.5.2/dsh-ai-reading-room-0.5.2.tgz
```

要求 Node.js 22.13.0+；DSH 兼容范围 `>=0.2.2-rc.2 <0.3.0`，实际验证基线为 DSH Desktop 0.2.2-rc.2。包中已包含构建产物，不需要安装时执行构建脚本。更新后刷新页面，必要时重启 DSH。

## 数据与验证

- 64 组自动化逻辑和数据回归测试通过，覆盖解析、标注、撤销/重做、冲突保护、幂等、迁移、备份和原生讨论协议。
- 已进行本机安装与原生接口核对。没有浏览器控制工具，未宣称完成全部真实页面拖动、明暗主题与在线模型交互验收。
- 原书与学习记录保存在用户 DSH 数据目录，不随安装包发布；更新不重写原章节或笔记正文。
- 撤销记录从新版支持的操作开始累计；已有回收站记录仍可恢复。
- PDF 扫描页尚不支持 OCR；不包含 MOBI/AZW3 转换、跨书主题、云同步或自动提醒。
- 此包不通过 npm 发布。市场上架还需满足仓库年龄门槛和维护者审核，以收录 PR 的实际状态为准。

---

## English

This preview consolidates the reading, Bookworm, methods, annotation and learning-record improvements since 0.1.0.

Highlights include goal-free conversations; editable and versioned reading methods; focus reading and resizable columns; text-anchored progress and verified source jumps; right-click-only five-color highlights and underlines; book-specific undo/redo; filtered learning records and selected export; reply-depth preferences; and explicitly requested, editable reviews that keep reader statements separate from AI suggestions. Optional experiments stay as text drafts and do not create tasks or reminders.

Use the pinned tarball above. It includes prebuilt artifacts and requires no install-time build scripts. Requires Node.js 22.13.0+ and DSH `>=0.2.2-rc.2 <0.3.0`; the tested runtime is DSH Desktop 0.2.2-rc.2.

All 64 automated logic/data tests pass. Local activation and native API checks are complete; full visual interaction and live-model walkthroughs are not claimed. User books and learning data are excluded. Undo history begins with supported new operations. OCR, MOBI/AZW3, cross-book topics, cloud sync and automatic reminders are not included. Market acceptance is separate from this GitHub release.
