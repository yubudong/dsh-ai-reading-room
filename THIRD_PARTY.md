# Third-party notices

Version 0.3.0 adds the original Bookworm mascot, generated for this project with ChatGPT image generation on 2026-11-25. It is distributed as `assets/bookworm-original.png` and optimized `assets/bookworm.webp`. Earlier Book Spirit artwork is retained only as an earlier design asset; the current companion is Bookworm.

This project is MIT licensed. Its dependencies retain their own licenses. Package versions are pinned by pnpm-lock.yaml; the runtime package manager also distributes upstream license files with dependencies.

- **PDF.js / pdfjs-dist** — Mozilla contributors, Apache-2.0. The built PDF worker is copied without modification from the installed distribution. The Client bundles the PDF.js library and uses its text-layer layout conventions; local selectors are namespaced under `.arr`. The Apache license is included in `assets/PDFJS-LICENSE`.
- **fflate** — Arjun Barrett and contributors, MIT. Used for EPUB containers and portable ZIP backups.
- **sanitize-html** — Apostrophe Technologies and contributors, MIT. Used to remove active ebook content before rendering.
- **fast-xml-parser**, **marked**, **entities**, **zod**, **@thednp/dommatrix** — upstream licenses and copyright notices remain in the corresponding dependency packages. Used for XML, Markdown, HTML entities, record validation and a DOMMatrix shim for Node text extraction.
- **esbuild**, **Prettier** — development tools; not loaded by the installed Client.
- **React** — supplied by DSH at runtime. No second React copy is bundled.

The original plugin icon was drawn for this project. The Book Spirit mascot was generated for this project using ChatGPT image generation on 2026-11-25; it was not copied from Time Spirit or another product. Its original PNG and optimized WebP are bundled under assets. The example reading material is original demonstration text, not an excerpt from a published book. User-imported ebooks are not covered by the plugin's software license and are excluded from the source repository and published package.
