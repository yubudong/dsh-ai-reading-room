import React, { useState, useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import { rpc, API, request, download } from "./api.js";
import { RecordCard } from "./forms.jsx";
import { SpiritPanel } from "./spirit.jsx";
pdfjs.GlobalWorkerOptions.workerSrc = API + "/pdf.worker.mjs";
// Sanitize again at the rendering boundary, including imported portable backups.
function safeHtml(html) {
  const d = new DOMParser().parseFromString(html, "text/html");
  const tags = new Set([
    "P",
    "DIV",
    "SPAN",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "BLOCKQUOTE",
    "UL",
    "OL",
    "LI",
    "STRONG",
    "EM",
    "B",
    "I",
    "U",
    "S",
    "PRE",
    "CODE",
    "BR",
    "HR",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "SUP",
    "SUB",
    "A",
    "IMG",
    "FIGURE",
    "FIGCAPTION",
    "DL",
    "DT",
    "DD",
  ]);
  for (const e of [...d.body.querySelectorAll("*")]) {
    if (!tags.has(e.tagName)) {
      e.remove();
      continue;
    }
    for (const a of [...e.attributes]) {
      if (
        a.name === "id" ||
        a.name === "alt" ||
        a.name === "title" ||
        ["colspan", "rowspan"].includes(a.name)
      )
        continue;
      if (
        e.tagName === "IMG" &&
        a.name === "src" &&
        /^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(a.value)
      )
        continue;
      if (e.tagName === "A" && a.name === "href" && a.value.startsWith("#"))
        continue;
      e.removeAttribute(a.name);
    }
  }
  return d.body.innerHTML;
}
function offsetAt(root, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}
function rangeAt(root, start, end) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let at = 0,
    node,
    from = null,
    to = null;
  while ((node = walker.nextNode())) {
    const next = at + node.textContent.length;
    if (from === null && start >= at && start < next) from = [node, start - at];
    if (end > at && end <= next) {
      to = [node, end - at];
      break;
    }
    at = next;
  }
  if (!from || !to) return null;
  const r = document.createRange();
  r.setStart(...from);
  r.setEnd(...to);
  return r;
}
export function Reader({
  info,
  setInfo,
  settings,
  t,
  lang,
  date,
  run,
  showNote,
  busy,
  back,
  setModal,
}) {
  const b = info.book;
  const [chapterId, setChapterId] = useState(b.progress.chapterId || "c0"),
    [chapter, setChapter] = useState(null),
    [side, setSide] = useState("spirit"),
    [toc, setToc] = useState(true),
    [selection, setSelection] = useState(null),
    [jump, setJump] = useState(null),
    [pdfMode, setPdfMode] = useState(true),
    [zoom, setZoom] = useState(1),
    [threadId, setThreadId] = useState(""),
    [fontSize, setFontSize] = useState(settings.fontSize);
  const body = useRef(null),
    prose = useRef(null),
    timer = useRef(null),
    chapterRef = useRef(chapterId),
    infoRef = useRef(info),
    seq = useRef(0);
  infoRef.current = info;
  chapterRef.current = chapterId;
  useEffect(() => {
    let alive = true;
    setChapter(null);
    setSelection(null);
    rpc({ action: "chapter", id: b.id, chapterId })
      .then((v) => {
        if (alive) setChapter(v.chapter);
      })
      .catch((e) => run(() => Promise.reject(e)));
    return () => {
      alive = false;
    };
  }, [chapterId]);
  useEffect(() => {
    try {
      const x = JSON.parse(
        sessionStorage.getItem("arr-jump:" + b.id) || "null",
      );
      if (x) {
        sessionStorage.removeItem("arr-jump:" + b.id);
        go(x);
      }
    } catch {}
    return () => {
      clearTimeout(timer.current);
    };
  }, []);
  const saveProgress = (id, offset) =>
    rpc({
      action: "progress",
      id: b.id,
      chapterId: id,
      offset,
      requestId: request(),
    });
  function scheduleProgress() {
    clearTimeout(timer.current);
    const id = chapterRef.current,
      offset = body.current?.scrollTop || 0;
    timer.current = setTimeout(
      () => saveProgress(id, offset).catch((e) => run(() => Promise.reject(e))),
      600,
    );
  }
  function changeChapter(id) {
    clearTimeout(timer.current);
    const old = chapterRef.current;
    if (body.current) saveProgress(old, body.current.scrollTop).catch(() => {});
    setChapterId(id);
  }
  function go(anchor) {
    setSelection(null);
    setJump({ ...anchor, key: ++seq.current });
    setChapterId(anchor.chapterId);
  }
  useEffect(() => {
    if (!chapter || !prose.current || (b.format === "pdf" && pdfMode)) return;
    prose.current.innerHTML = safeHtml(chapter.html);
    const intervals = info.records
      .filter(
        (r) =>
          !r.deletedAt &&
          r.anchor?.chapterId === chapter.id &&
          r.anchor.end > r.anchor.start &&
          prose.current.textContent.slice(r.anchor.start, r.anchor.end) ===
            r.anchor.quote,
      )
      .map((r) => [r.anchor.start, r.anchor.end])
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [start, end] of intervals) {
      const last = merged.at(-1);
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    }
    const walker = document.createTreeWalker(
        prose.current,
        NodeFilter.SHOW_TEXT,
      ),
      segments = [];
    let node,
      at = 0;
    while ((node = walker.nextNode())) {
      const end = at + node.textContent.length;
      for (const [s, e] of merged) {
        const from = Math.max(at, s),
          to = Math.min(end, e);
        if (from < to) segments.push({ node, start: from - at, end: to - at });
      }
      at = end;
    }
    for (const s of segments.reverse()) {
      const range = document.createRange();
      range.setStart(s.node, s.start);
      range.setEnd(s.node, s.end);
      range.surroundContents(document.createElement("mark"));
    }
    if (jump && jump.chapterId === chapter.id) {
      const r = rangeAt(prose.current, jump.start, jump.end);
      r?.startContainer.parentElement?.scrollIntoView({ block: "center" });
    } else if (body.current)
      body.current.scrollTop =
        chapter.id === b.progress.chapterId ? b.progress.offset : 0;
  }, [chapter, info.records, fontSize, jump, pdfMode]);
  function capture() {
    if (!prose.current || !chapter) return;
    const s = window.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    if (!prose.current.contains(r.commonAncestorContainer)) return;
    const start = offsetAt(prose.current, r.startContainer, r.startOffset),
      end = offsetAt(prose.current, r.endContainer, r.endOffset),
      quote = chapter.text.slice(start, end);
    if (quote && quote.length <= 20000)
      setSelection({ chapterId: chapter.id, start, end, quote });
  }
  async function update() {
    setInfo(await rpc({ action: "open", id: b.id }));
  }
  const allRecords = info.records.filter((r) => !r.deletedAt),
    chapterIndex = info.chapters.findIndex((c) => c.id === chapterId);
  return (
    <>
      <div className="readbar row spread">
        <div className="row">
          <button
            onClick={() => {
              clearTimeout(timer.current);
              run(async () => {
                await saveProgress(chapterId, body.current?.scrollTop || 0);
                back();
              });
            }}
          >
            {t("back")}
          </button>
          <button aria-selected={toc} onClick={() => setToc(!toc)}>
            {t("contents")}
          </button>
          <b>{b.title}</b>
          <span className="pill">{t(b.status)}</span>
        </div>
        <div className="row">
          <button
            onClick={() =>
              setModal({ kind: "search", bookId: b.id, onJump: go })
            }
          >
            {t("searchText")}
          </button>
          <button onClick={() => setModal({ kind: "meta", book: b })}>
            {t("metadata")}
          </button>
          <button
            onClick={() =>
              run(async () => {
                const v = await rpc({ action: "export", id: b.id });
                download(v.text, v.name, "text/markdown;charset=utf-8");
              })
            }
          >
            {t("export")}
          </button>
        </div>
      </div>
      <div className="reader">
        {toc && (
          <aside className="toc">
            <div className="muted small">
              {t("contents")} · {info.chapters.length}
            </div>
            {info.chapters.map((c) => (
              <button
                key={c.id}
                aria-selected={c.id === chapterId}
                onClick={() => changeChapter(c.id)}
              >
                {b.format === "pdf"
                  ? t("pdfLabel") + " " + (c.index + 1)
                  : c.title}
              </button>
            ))}
          </aside>
        )}
        <main className="reading">
          <div className="readbar row spread">
            <div className="row">
              <button
                disabled={chapterIndex <= 0}
                onClick={() =>
                  changeChapter(info.chapters[chapterIndex - 1].id)
                }
              >
                {t("prev")}
              </button>
              <span className="small">
                {chapterIndex + 1} / {info.chapters.length}
              </span>
              <button
                disabled={chapterIndex >= info.chapters.length - 1}
                onClick={() =>
                  changeChapter(info.chapters[chapterIndex + 1].id)
                }
              >
                {t("next")}
              </button>
            </div>
            <div className="row">
              {b.format === "pdf" ? (
                <>
                  <button onClick={() => setPdfMode(!pdfMode)}>
                    {t(pdfMode ? "textMode" : "pageMode")}
                  </button>
                  <button onClick={() => setZoom(Math.max(0.5, zoom - 0.15))}>
                    −
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(Math.min(2, zoom + 0.15))}>
                    +
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setFontSize(Math.max(14, fontSize - 1))}
                  >
                    A−
                  </button>
                  <span>{fontSize}</span>
                  <button
                    onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                  >
                    A+
                  </button>
                </>
              )}
            </div>
          </div>
          {selection && (
            <div className="selection">
              <blockquote>{selection.quote}</blockquote>
              <div className="row">
                {["highlight", "reflection", "question"].map((k) => (
                  <button key={k} onClick={() => showNote(b.id, k, selection)}>
                    {t(k)}
                  </button>
                ))}
                <button
                  className="primary"
                  onClick={() => {
                    setSide("spirit");
                  }}
                >
                  {t("ask")}
                </button>
                <button onClick={() => setSelection(null)}>
                  {t("clearSelection")}
                </button>
              </div>
            </div>
          )}
          <div className="body" ref={body} onScroll={scheduleProgress}>
            {!chapter ? (
              <p>{t("loading")}</p>
            ) : b.format === "pdf" && pdfMode ? (
              <>
                <PdfPage
                  book={b}
                  chapter={chapter}
                  pageIndex={chapter.index}
                  zoom={zoom}
                  t={t}
                  onError={(e) => run(() => Promise.reject(e))}
                  onSelect={setSelection}
                  records={allRecords}
                  jump={jump}
                />
                <div className="row" style={{ marginTop: 14 }}>
                  <button
                    onClick={() =>
                      showNote(
                        b.id,
                        "note",
                        {
                          chapterId: chapter.id,
                          start: 0,
                          end: 0,
                          quote: "",
                          pageOnly: true,
                        },
                        t("pdfLabel") + " " + (chapter.index + 1),
                      )
                    }
                  >
                    {t("bookmark")}
                  </button>
                  {b.hasText && (
                    <button onClick={() => setPdfMode(false)}>
                      {t("textMode")}
                    </button>
                  )}
                </div>
                {!b.hasText && <p className="muted">{t("scanned")}</p>}
              </>
            ) : (
              <article
                ref={prose}
                className="prose"
                onMouseUp={capture}
                onKeyUp={capture}
                style={{
                  fontSize: fontSize + "px",
                  lineHeight: settings.lineHeight,
                  maxWidth: settings.pageWidth,
                }}
              />
            )}
          </div>
          <footer className="footer">
            {chapter?.title} · {t("selectHint")}
          </footer>
        </main>
        <aside className="side">
          <div className="row sidetabs">
            {["spirit", "notes", "history"].map((k) => (
              <button
                key={k}
                aria-selected={side === k}
                onClick={() => setSide(k)}
              >
                {t(k)}
                {k === "notes" ? " · " + allRecords.length : ""}
              </button>
            ))}
          </div>
          {side === "spirit" ? (
            <SpiritPanel
              key={b.id}
              book={b}
              chapters={info.chapters}
              chapterId={chapterId}
              anchor={selection}
              t={t}
              lang={lang}
              date={date}
              run={run}
              onUpdate={update}
              exercises={info.exercises}
              showNote={showNote}
              onJump={go}
            />
          ) : (
            <div className="sidebody">
              {side === "notes" ? (
                <>
                  <button onClick={() => showNote(b.id, "note")}>
                    {t("newNote")}
                  </button>
                  <div style={{ marginTop: 14 }}>
                    {allRecords.length ? (
                      allRecords
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                        .map((r) => (
                          <RecordCard
                            key={r.id}
                            r={r}
                            t={t}
                            date={date}
                            onSource={go}
                            onEdit={(r) =>
                              setModal({
                                kind: "note",
                                record: r,
                                bookId: b.id,
                                type: r.kind,
                                body: r.body,
                                anchor: r.anchor,
                                origin: r.origin,
                              })
                            }
                            onTrash={(r) =>
                              run(async () => {
                                await rpc({
                                  action: "trashRecord",
                                  id: r.id,
                                  revision: r.revision,
                                  requestId: request(),
                                });
                                await update();
                              })
                            }
                          />
                        ))
                    ) : (
                      <p className="muted">{t("noNotes")}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="card">
                    <b>
                      {t("history")} · #{b.progress.pass}
                    </b>
                    <p>{date(b.createdAt)}</p>
                    <p className="muted">{t("newPassHint")}</p>
                    <button
                      onClick={() =>
                        run(async () => {
                          await rpc({
                            action: "newPass",
                            id: b.id,
                            revision: b.revision,
                            requestId: request(),
                          });
                          await update();
                          setChapterId("c0");
                        })
                      }
                    >
                      {t("newPass")}
                    </button>
                  </div>
                  {[
                    ...allRecords.map((r) => ({
                      at: r.createdAt,
                      label: t(r.kind),
                      body: r.body || r.anchor?.quote,
                      anchor: r.anchor,
                    })),
                    ...info.exercises.map((x) => ({
                      at: x.createdAt,
                      label: t(x.method),
                      body: x.goal,
                    })),
                  ]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((x, i) => (
                      <div className="card" key={i}>
                        <div className="small muted">{date(x.at)}</div>
                        <b>{x.label}</b>
                        <p>{x.body}</p>
                        {x.anchor && (
                          <button onClick={() => go(x.anchor)}>
                            {t("source")}
                          </button>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
function PdfPage({
  book,
  chapter,
  pageIndex,
  zoom,
  t,
  onError,
  onSelect,
  records,
  jump,
}) {
  const host = useRef(null),
    canvas = useRef(null),
    layer = useRef(null),
    docRef = useRef(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    let alive = true;
    const task = pdfjs.getDocument({
      url: API + "/original?id=" + encodeURIComponent(book.id),
      isEvalSupported: false,
      useSystemFonts: true,
      cMapUrl: API + "/pdf-resource?kind=cmaps&name=",
      cMapPacked: true,
      standardFontDataUrl: API + "/pdf-resource?kind=standard_fonts&name=",
      wasmUrl: API + "/pdf-resource?kind=wasm&name=",
    });
    task.promise
      .then((doc) => {
        if (alive) {
          docRef.current = doc;
          setReady(true);
        }
      })
      .catch((e) => alive && onError(e));
    return () => {
      alive = false;
      task.destroy();
    };
  }, [book.id]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false,
      render = null,
      textLayer = null;
    setLoading(true);
    (async () => {
      const p = await docRef.current.getPage(pageIndex + 1);
      if (cancelled) return;
      const scale =
        Math.min(
          1.25,
          Math.max(
            0.45,
            (host.current.parentElement.clientWidth - 70) /
              p.getViewport({ scale: 1 }).width,
          ),
        ) * zoom;
      const vp = p.getViewport({ scale });
      const c = canvas.current;
      c.width = Math.floor(vp.width * devicePixelRatio);
      c.height = Math.floor(vp.height * devicePixelRatio);
      c.style.width = vp.width + "px";
      c.style.height = vp.height + "px";
      host.current.style.width = vp.width + "px";
      layer.current.replaceChildren();
      layer.current.style.setProperty("--total-scale-factor", String(scale));
      setSize({ width: vp.width, height: vp.height });
      render = p.render({
        canvasContext: c.getContext("2d"),
        viewport: vp,
        transform: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
      });
      await render.promise;
      if (cancelled) return;
      textLayer = new pdfjs.TextLayer({
        textContentSource: await p.getTextContent(),
        container: layer.current,
        viewport: vp,
      });
      await textLayer.render();
      if (!cancelled) setLoading(false);
    })().catch((e) => {
      if (
        !cancelled &&
        e.name !== "RenderingCancelledException" &&
        e.name !== "AbortException"
      )
        onError(e);
    });
    return () => {
      cancelled = true;
      render?.cancel();
      textLayer?.cancel();
    };
  }, [ready, pageIndex, zoom]);
  function capture() {
    const s = window.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    if (!layer.current.contains(r.commonAncestorContainer)) return;
    const quote = s.toString(),
      compact = quote.replace(/\s/g, "");
    if (!compact || compact.length > 20000) return;
    const chars = [],
      indices = [];
    for (let i = 0; i < chapter.text.length; i++)
      if (!/\s/.test(chapter.text[i])) {
        chars.push(chapter.text[i]);
        indices.push(i);
      }
    const prefix = offsetAt(layer.current, r.startContainer, r.startOffset);
    const preRange = document.createRange();
    preRange.selectNodeContents(layer.current);
    preRange.setEnd(r.startContainer, r.startOffset);
    const at = preRange.toString().replace(/\s/g, "").length;
    const all = chars.join("");
    let idx = all.indexOf(compact, Math.max(0, at - 3));
    if (idx < 0) idx = all.indexOf(compact);
    if (idx < 0) return;
    const start = indices[idx],
      end = indices[idx + compact.length - 1] + 1;
    const box = host.current.getBoundingClientRect(),
      rects = [...r.getClientRects()]
        .filter((x) => x.width > 0 && x.height > 0)
        .slice(0, 300)
        .map((x) => ({
          x: Math.max(0, Math.min(1, (x.x - box.x) / box.width)),
          y: Math.max(0, Math.min(1, (x.y - box.y) / box.height)),
          width: Math.max(0, Math.min(1, x.width / box.width)),
          height: Math.max(0, Math.min(1, x.height / box.height)),
        }));
    onSelect({
      chapterId: chapter.id,
      start,
      end,
      quote: chapter.text.slice(start, end),
      rects,
    });
  }
  const marks = records
    .filter((r) => r.anchor?.chapterId === chapter.id)
    .flatMap((r) => r.anchor.rects || []);
  return (
    <>
      <div className="pdfbox" ref={host}>
        <canvas ref={canvas} />
        <div
          className="pdftext"
          ref={layer}
          onMouseUp={capture}
          onKeyUp={capture}
        />
        {marks.map((r, i) => (
          <div
            key={i}
            className="pdfmark"
            style={{
              left: r.x * size.width,
              top: r.y * size.height,
              width: r.width * size.width,
              height: r.height * size.height,
            }}
          />
        ))}
      </div>
      {loading && <p>{t("loading")}</p>}
    </>
  );
}
