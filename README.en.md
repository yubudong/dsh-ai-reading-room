# AI Reading Room

A personal reading room to explore books, reflect on ideas, and learn with AI.

[简体中文](README.md)

This DSH desktop plugin adds **AI reading room** to the left sidebar. Its companion, **Book Spirit** (书灵), uses native DSH sessions and your configured model. Version 0.1.0 is an early preview released under the MIT license.

## Install

Requires DSH 0.2.2-rc.2 or a compatible 0.2.x release and Node.js 22.13.0+. The tested baseline is DSH Desktop 0.2.2-rc.2.

In **Plugins → Add plugin**, use the prebuilt release URL:

```text
https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.1.0/dsh-ai-reading-room-0.1.0.tgz
```

Or install with the CLI, replacing `<profile>` with your profile name:

```sh
dsh plugin --profile <profile> add https://github.com/yubudong/dsh-ai-reading-room/releases/download/v0.1.0/dsh-ai-reading-room-0.1.0.tgz
```

The repository also includes built artifacts, so installation from GitHub does not require build scripts:

```sh
dsh plugin --profile <profile> add github:yubudong/dsh-ai-reading-room
```

Refresh the DSH page after installation; restart DSH if an old build remains loaded. The package is not published on npm. Market listing depends on maintainer acceptance.

## Use

Add the plugin directory in DSH Plugins and enable it. Open the sidebar entry and import EPUB, PDF, TXT or Markdown files. Select source text to highlight it, write a reflection, save a question or discuss it with Book Spirit. The reading pane includes notes and a dated history.

Choose open discussion, question-led reading, teach-back or perspective debate. Exercises retain their goal, stage, paused/completed state and visible conversation. Context is limited to a source passage or chapter excerpt and tools that read the current book. Your selected content is sent to the model service configured in DSH.

Settings provide reply-language and model preferences, reading typography, Markdown export and ZIP backups. Restore replaces current reading-room records after a preview and a local snapshot. Imported native-session identities are cleared: the visible history remains, while the next message starts a fresh native session.

## Data and limits

Structured records use the DSH `ai_reading_room_v1` storage unit. Original files and parsed content are stored under the DSH home in `ai-reading-room/books`, identified by SHA-256. Source files are not modified. Pre-restore snapshots are in `ai-reading-room/backups`. Browser-local drafts are not included in server backups.

- Text EPUBs use sanitized reflowed content, without original CSS, active scripts or remote images. Complex fixed layouts, vertical writing, multimedia and math are not fully supported.
- PDFs support original pages, a selectable text layer and a text view. Scanned pages are viewable and can be bookmarked; OCR is not included.
- TXT supports UTF-8, GB18030 and Big5. Markdown local-image resources are not copied automatically.
- Maximum file size: 64 MiB. PDF limit: 2,500 pages. ZIP decompression limit: 192 MiB. Large libraries do not yet support split backups.
- Search is case-insensitive literal matching with up to 100 hits, without semantic or cross-language vector search.
- MOBI/AZW3 conversion, cross-book topics, life-practice boards, reminders and cloud sync are planned for later versions.
- Citation links refer only to available chapters actually included in context or read by tools. They do not certify the correctness of an AI interpretation.
- Compatibility baseline: DSH 0.2.2-rc.2. Other releases require validation.

## Development

Node 22.13.0+ and pnpm are required. Install scripts are not required.

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm test
```

Host and Client source live under `src/host` and `src/client`. The package ships built artifacts and a PDF.js worker. No DSH implementation files are modified. Never commit personal books, credentials or user data.

MIT license. Third-party notices are listed in THIRD_PARTY.md. The public repository includes source, tests and prebuilt artifacts. This early preview is distributed through GitHub Releases; npm publication and market acceptance are separate steps.
