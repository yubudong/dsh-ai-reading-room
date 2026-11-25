# AI Reading Room

A personal reading room to explore books, reflect on ideas, and learn with AI.

[简体中文](README.md)

This DSH desktop plugin adds **AI reading room** to the left sidebar. Its companion, **Bookworm** (书虫), uses native DSH sessions and your configured model. Version 0.5.3 distributes the prebuilt reading workspace through npm and GitHub Releases. The project is MIT licensed.

## Install

Requires DSH 0.2.2-rc.2 or a compatible 0.2.x release and Node.js 22.13.0+. The tested baseline is DSH Desktop 0.2.2-rc.2.

In **Plugins → Add plugin**, enter `dsh-ai-reading-room`, or use:

```sh
dsh plugin --profile <profile> add dsh-ai-reading-room@0.5.3
```

To download the package into a Node project:

```sh
npm install dsh-ai-reading-room@0.5.3
```

A plain npm install downloads the package; activating it in DSH still requires its plugin manager or the DSH command above.

GitHub prebuilt release URL:

```text
https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.5.3/dsh-ai-reading-room-0.5.3.tgz
```

Or install with the CLI, replacing `<profile>` with your profile name:

```sh
dsh plugin --profile <profile> add https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.5.3/dsh-ai-reading-room-0.5.3.tgz
```

The repository also includes built artifacts, so installation from GitHub does not require build scripts:

```sh
dsh plugin --profile <profile> add github:yubudong/dsh-ai-reading-room
```

Refresh the DSH page after installation; restart DSH if an old build remains loaded. The npm package name is `dsh-ai-reading-room`. Market listing depends on maintainer acceptance.

## Use

Add the plugin directory in DSH Plugins and enable it. Open the sidebar entry and import EPUB, PDF, TXT or Markdown files. Select source text and right-click to highlight it, write a reflection, save a question or discuss it with Bookworm. Selection alone opens no annotation palette. The reading pane includes notes and a dated history.

Open a book and type directly. Switch between chat, question-led exploration, teach-back and perspective debate within the same conversation. There is no required goal form or manual stage sequence. Selecting a method does not call the model; send a message or choose “Read this with me” when ready. Earlier goals and records remain available in history.

Drag the panel’s left edge to resize it; arrow keys adjust the focused separator, and double-click or Enter resets it. Expand, restore or close the panel from its header. The model selector and refresh control live inside the composer. Choices are saved per discussion without changing the global DSH default. Enter sends; Shift+Enter adds a line, and IME composition is respected.

Context is limited to a source passage or chapter excerpt and tools that read the current book. Your selected content is sent to the configured model service. The original Bookworm mascot—a teal bookworm with round glasses peeking out of an open book—is bundled for offline display.

Settings provide reply-language and model preferences, reading typography, Markdown export and ZIP backups. Restore replaces current reading-room records after a preview and a local snapshot. Imported native-session identities are cleared: the visible history remains, while the next message starts a fresh native session.

## Distribution update 0.5.3

Adds npm distribution and explicit publish configuration, with the same application behavior as 0.5.2. The existing 0.5.2 GitHub package and checksums remain unchanged.

## Version 0.5.2

- Right-click-only highlights and underlines, with 50 book-specific undo/redo steps. Cmd+Z/Cmd+Shift+Z on Mac; Ctrl+Z/Ctrl+Shift+Z on Windows. Editors retain native text undo.
- Focus reading, resizable columns, text-anchored progress, verified passage references and return navigation.
- Filter learning records by book, color, type, date, unwritten marks and open questions; export selected records.
- Chat and reading-method entries, editable prompts, personal versions, favorites and historical prompt snapshots.
- Brief/balanced/in-depth reply preferences and explicitly requested editable reading reviews, with reader words and AI suggestions separated. Optional experiments remain text drafts, without creating tasks or reminders.
- 64 logic and data regression tests pass. Full visual acceptance, light/dark interaction checks and a complete live-model walkthrough remain unverified; see the verification notes.

## Library and reading methods

Imports now provide clear next actions. Scan folders recursively for copied imports or link existing folders without duplicate originals. Change the managed library location from Settings; migration copies and verifies files before switching and keeps old files. Existing EPUB navigation can be repaired without changing source text or saved quote offsets.

The method library offers full prompt previews, temporary edits, custom methods, ordering, disabling and JSON import/export. Prompt cards can be full, compact or hidden. The exact method prompt is retained for each turn.

The searchable bilingual guide and shortcut reference are available from Help, alongside Bookworm usage assistance. Reader shortcuts are device-local and apply only with body focus; inputs and IME composition are protected.

- [English user guide](docs/USER_GUIDE.en.md)
- [中文使用说明书](docs/USER_GUIDE.zh.md)

Learning-asset backups now use format version 2. This version reads earlier version 1 backups; older plugins are not guaranteed to read new backups.

## Data and limits

Structured records use the DSH `ai_reading_room_v1` storage unit. Originals default to `ai-reading-room/library` under the DSH home (configurable); parsed content remains in `ai-reading-room/books`, identified by SHA-256. Source files are not modified. Pre-restore snapshots are in `ai-reading-room/backups`. Browser-local drafts are not included in server backups.

- Text EPUBs use sanitized reflowed content, without original CSS, active scripts or remote images. Complex fixed layouts, vertical writing, multimedia and math are not fully supported.
- PDFs support original pages, a selectable text layer and a text view. Scanned pages are viewable and can be bookmarked; OCR is not included.
- TXT supports UTF-8, GB18030 and Big5. Markdown local-image resources are not copied automatically.
- Maximum file size: 64 MiB. PDF limit: 2,500 pages. ZIP decompression limit: 192 MiB. Large libraries do not yet support split backups.
- Search is case-insensitive literal matching with up to 100 hits, without semantic or cross-language vector search.
- MOBI/AZW3 conversion, cross-book topics, life-practice boards, reminders and cloud sync are planned for later versions.
- Citation links favor verified passages actually supplied or read by tools; older conversations may link only to a chapter. They do not certify the correctness of an AI interpretation.
- Compatibility baseline: DSH 0.2.2-rc.2. Other releases require validation.

## Development

Node 22.13.0+ and pnpm are required. Install scripts are not required.

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm test
```

Host and Client source live under `src/host` and `src/client`. The package ships built artifacts and a PDF.js worker. No DSH implementation files are modified. Never commit personal books, credentials or user data.

MIT license. Third-party notices are listed in THIRD_PARTY.md. The public repository includes source, tests and prebuilt artifacts. This preview is distributed through npm and GitHub Releases; market acceptance remains a separate step.
