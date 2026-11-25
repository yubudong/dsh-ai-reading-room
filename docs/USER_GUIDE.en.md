# AI Reading Room user guide

Version 0.5.2

## Start reading in three minutes

Import a book from the header. Click Start reading after a single import, or View imported books after a batch. Use Try a sample when no book is ready. Select text to highlight, reflect, save a question or ask Bookworm. You can also type directly, without a goal form. Onboarding can be skipped and reopened from Help.

## Files, folders and linked libraries

Import copies a file into the managed library without changing the download. Batch folder import scans, lets you select files and copies them; include subfolders optionally. Linking keeps originals in their folder without another copy. Rescan to discover new books, or opt into checking when the room opens. Symlinks are not followed. Completion separates success, duplicate and failed files and offers clear next actions. TXT encoding is under Advanced.

## Library location, migration and missing files

Settings & backup → Library & files shows the managed location and linked folders. Originals live in the library; parsed caches, learning records and native sessions are managed under DSH data. Changing location copies and verifies originals before switching; old files are retained. Book IDs and citations stay stable. Place ebooks into the library and scan to add them. If a linked file moves, notes remain. Relink its directory or locate the same original from Book details.

## Reading, contents and search

Contents use EPUB navigation, including nesting and fragment targets. Focus (or F with body focus) hides the page header and repeated tools; search, export, settings and reviews remain in More. Save feedback uses a brief overlay; failures offer retry. New progress uses text anchors across font and column changes, while old pixel progress remains compatible. Return to reading (or R with body focus) restores the place before a reference jump. Drag the right edge of the contents panel to resize it; the width is remembered on this device. Double-click or Enter resets it; arrow keys adjust the focused separator. Repair contents in Book details for older imports; body text and annotation positions are preserved, with a warning when a safe match is unavailable. Space/PageDown advances a screen in scrolling mode; arrows scroll in small steps. At a PDF page edge, navigation can move to the adjacent page. Previous/next chapter explicitly skips chapters. PDFs have original and text views. Search book text from the header and jump from results. Hover truncated titles to read them.

## Talk with Bookworm, choose a model and save replies

Select a passage and Ask Bookworm, or type directly. Choose Brief, Balanced or In depth for later replies; explicit requests take priority. Follow-ups under the latest reply ask for examples, simplicity or deeper reasoning while keeping the previous source scope and your draft. Source buttons favor verified passages; older discussions may still link to a chapter. Choose the discussion model inside the composer. Enter sends, Shift+Enter adds a line; IME composition is protected. Drag the left panel edge to resize, double-click to reset, and use header controls to expand or close it. History resumes a discussion; New starts another. Save to notes opens a reviewable AI-origin note. Stop a reply anytime. Source scope shows selected text or a chapter excerpt sent to the selected model, not the entire library.

## Reading methods and full prompts

Choose Chat or Reading methodologies in the sidebar. Search built-in and personal methods; favorites and recent methods appear first. First use of each method opens a dialog with scenarios, steps and an editable full prompt. Do not open automatically is remembered per method across books; View & edit always reopens it. Selecting or applying sends no model request and keeps your question draft. Use for this turn affects the next message only; save a personal version or new method for reuse. Inspect expanded instructions and references, or optionally pin the full prompt. Each turn retains its actual prompt snapshot. Switching affects later messages; no predefined question is required.

## Create and manage your methods

Open Reading methodologies in the main navigation. A name and full prompt are required; descriptions, scenarios and usage steps are optional. Edit a built-in as a personal version and restore its default anytime. Edit, copy, order, favorite, disable/re-enable and inspect earlier prompt revisions. Variables {{book}}, {{author}}, {{chapter}} and {{selection}} use the current context; {{notes}} requires an explicit opt-in. Bookworm can suggest metadata drafts for your review. JSON exports include personal versions and imports create independent methods. Full backups retain histories and introduction preferences. Settings can reset all first-use introductions. Earlier discussions keep the prompts actually used.

## Five-color highlights, underlines and context actions

Selecting text or clicking a mark opens no annotation tools. Only right-clicking the selection or an existing mark opens the menu, with yellow, green, blue, pink and purple highlights or an independent underline, saved directly. Right-click a selection or existing mark to recolor, add/edit a note, remove the mark, ask Bookworm, translate, search this book or copy. Ordinary positions keep the system menu. Escape or clicking away closes the popover. Each book keeps its latest 50 reader annotation actions for undo/redo, including creation, color, underline and removal. Use Cmd+Z / Cmd+Shift+Z on Mac or Ctrl+Z / Ctrl+Shift+Z on Windows, or the toolbar/context menu buttons. Inputs retain native text undo. Only appearance and trash state are restored; later note edits are kept. Changes from other entry points invalidate older commands rather than overwriting them. Restoring a backup clears command history. Recoloring keeps notes and source anchors. Removing a mark with note text keeps the note; pure marks go to recoverable Trash. Legacy marks retain an underline fallback and can be recolored. EPUB, text views and selectable PDF text are supported; OCR is not included. Translate prefills a question for you to send.

## Learning records, trash and backups

Highlights, reflections, questions and long notes retain dates and sources. Edits keep history; deletion goes to Trash without deleting originals. My notes & history searches across books and filters by book, color, type, creation date, unwritten marks or open questions. Jump directly to sources, mark questions understood or reopen them, and export only selected records. Date filters use the device time zone. Color names can be customized without imposing meanings. Markdown export carries notes and conversations. Settings & backup downloads learning assets or includes originals. Restore previews counts and snapshots current state before replacing records. Full native session runtime and model credentials are not in plugin backups; visible history can start a fresh native session.

## Session reviews and optional life experiments

Open More → Reading review or the review button in Bookworm. A base draft uses saved records and reader messages within the session range; a question is not proof of understanding. Inspect the materials, including reader words, saved records, AI replies and a chapter excerpt. Long or numerous inputs are bounded and limitations shown. Edit your draft or explicitly ask Bookworm to organize suggestions. AI output is separate and inserted only by your choice, never overwriting ongoing edits. Adjust the source range and restart with an option to restore the previous draft. Save to My notes & history with user and AI origins distinguished. Optional experiments stay as text; no task, schedule or reminder is created. Started replies remain available in discussion history after closing the dialog.

## Reading shortcuts and focus

Shortcuts apply when the reading body is focused. Click the body to use Space, arrows and PageUp/PageDown. Chat, note editors and search fields keep normal text input. Contents and modals have their own key behavior. Tab moves focus; Escape closes overlays. The shortcut reference shows effective device-local bindings and supports customization, disabling and reset. Reserved system/DSH combinations are not overridden. If the host consumes a binding first, use its button or choose another.

## Troubleshooting and current limits

After import, choose Start reading. Open an existing book for duplicates. Repair repeated contents labels. Relocate missing linked originals rather than deleting notes. Check model configuration in DSH and refresh the model list. For shortcuts, check body focus, overlays and system conflicts. Supported formats are EPUB, PDF, TXT and Markdown; scanned PDF viewing works, but OCR, MOBI/AZW3, cloud sync and a separate life-practice board are not included. Limits: 64 MiB per book, 2,500 PDF pages, 192 MiB uncompressed ZIP. Reading and notes work offline; AI needs an available model.

| Action | Windows/Linux defaults | macOS defaults |
|---|---|---|
| Undo annotation | Ctrl+Z | ⌘+Z |
| Redo annotation | Ctrl+Shift+Z | ⌘+Shift+Z |
| Toggle focus reading | F | F |
| Return to reading position | R | R |
| Scroll down | ↓ | ↓ |
| Scroll up | ↑ | ↑ |
| Next screen / page | Space / PageDown / → | Space / PageDown / → |
| Previous screen / page | Shift+Space / PageUp / ← | Shift+Space / PageUp / ← |
| Start of chapter | Home | Home |
| End of chapter | End | End |
| Search this book | Ctrl+F | ⌘+F |
| Go to chapter / page | Ctrl+G | ⌘+G |
| Increase text size / zoom | = / Shift+= / Num + | = / Shift+= / Num + |
| Decrease text size / zoom | − / Num − | − / Num − |
| Toggle contents | T | T |
| Bookmark current location | B | B |
| Note on selection | N | N |
| Ask Bookworm about selection | A | A |
| Shortcut reference | Shift+/ | Shift+/ |

These are defaults; the in-app guide shows your effective device-local bindings.
