# AI 书房 · AI Reading Room

与 AI 一起读书、思考，让阅读所得融入生活。

[English](README.en.md)

DSH 桌面插件，侧栏入口「AI 书房」，内置阅读伙伴「书灵」。包名 `dsh-ai-reading-room`，当前为 0.1.0 内测版，使用 MIT 许可证开源。

## 安装

要求 DSH 0.2.2-rc.2 或兼容的 0.2.x 版本、Node.js 22.13.0 及以上。当前实际验证基线为 DSH Desktop 0.2.2-rc.2。

推荐使用预构建发行包。在 DSH 的「插件 → 添加插件」中输入：

```text
https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.1.0/dsh-ai-reading-room-0.1.0.tgz
```

也可以使用 CLI，将 `<profile>` 替换为你的配置名称：

```sh
dsh plugin --profile <profile> add https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.1.0/dsh-ai-reading-room-0.1.0.tgz
```

从 GitHub 源码安装也可用，仓库已包含构建产物，不要求安装时执行构建脚本：

```sh
dsh plugin --profile <profile> add github:yubudong/dsh-ai-reading-room
```

安装后刷新 DSH 页面；若仍保留旧界面，重启 DSH。插件尚未发布 npm；市场收录以维护者合并后的实际状态为准。

## 使用

在 DSH 插件管理中添加本地插件目录并启用。左侧进入 AI 书房，导入 EPUB、PDF、TXT 或 Markdown。点开书籍阅读，选中文字后可以划线、写感悟、记疑问或向书灵提问。右侧切换笔记与阅读历程。

书灵提供自由讨论、狩猎法（带问题读）、费曼法（讲给书灵听）、辩论法（检验观点）。每次练习有目标、阶段与暂停状态，历史保存在本机。书灵通过 DSH 原生会话使用已配置的模型；相关选段或章节摘录会发送给对应服务。笔记与阅读无需模型在线。

设置中可以选择回复语言、模型和阅读字号，导出学习资产或含原书的 ZIP 备份。恢复会替换当前书房记录，预先展示数量并在本地自动保存旧数据快照。模型凭据不在备份中。导入的原生会话 ID 会清除，历史文字保留，下一次发送建立新会话。

## 数据

结构化记录存入 DSH 的 `ai_reading_room_v1` 数据单元。原书与解析文件保存到 DSH home 下的 `ai-reading-room/books`，文件按 SHA-256 标识。源文件不修改。备份前快照在 `ai-reading-room/backups`。

划线与笔记保存具体文件哈希、章节 ID、文本范围、原文及日期。普通笔记修订带版本保护；删除进入可恢复回收站。界面草稿只保存在浏览器本地，不属于服务器备份。

## 当前边界

- EPUB 使用清理后的重排阅读，去除脚本、原始 CSS 和远程图片；支持常见文字、内嵌栅格图片和书内锚点。固定版式、音视频、复杂数学与竖排未适配。
- PDF 提供原版、可选择的文字层与文字视图；选区保存文字范围和页面坐标。扫描版只看原版和记页码笔记，尚无 OCR。
- TXT 支持 UTF-8、GB18030 和 Big5；Markdown 本地图片不自动复制，远程图片不加载。
- 单本上限 64 MiB；PDF 上限 2500 页；ZIP 解压合计上限 192 MiB。大书库备份需控制规模，当前还没有分卷备份。
- 检索为大小写不敏感的字面匹配，最多返回 100 个命中；尚无语义或跨语言向量检索。
- 尚不包含 MOBI/AZW3 转换、跨书主题、生活实践模块、提醒、云同步。
- 引用链接只代表已有章节可跳转，不能自动证明 AI 解释正确。请回到原文核对。
- 兼容验证基线为 DSH 0.2.2-rc.2；其他版本需要另行验证。

## 开发

使用 Node 22.13.0+ 与 pnpm。依赖不需要运行安装脚本。

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm test
```

源代码在 `src/host` 与 `src/client`。构建产物 `index.js`、`host.js`、`client.js` 和 PDF worker 随包交付。构建不修改 DSH 安装目录。数据与个人图书不得提交到仓库。

MIT。第三方依赖许可见 THIRD_PARTY.md。
