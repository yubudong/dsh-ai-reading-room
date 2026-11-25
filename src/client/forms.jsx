import React, { useState, useEffect, useRef } from "react";
import { ImportWizard } from "./import-wizard.jsx";
import { LibrarySettings } from "./library-settings.jsx";
import { HelpCenter } from "./help-center.jsx";
import { GoTo } from "./go-to.jsx";
import { ReadingReview } from "./reading-review.jsx";
import { LearningTraces } from "./learning-traces.jsx";
import { AnnotationLabels } from "./annotation-labels.jsx";
import { SpiritMessage } from "./spirit-message.jsx";
import { MethodologyDialog } from "./methodology-dialog.jsx";
import { AnnotationSwatches, AnnotationBadge } from "./annotation-menu.jsx";
import { annotationAppearance } from "../shared/annotations.js";
import {
  rpc,
  API,
  request,
  download,
  base64File,
  localizeError,
} from "./api.js";
export function RecordCard({
  r,
  t,
  date,
  onEdit,
  onTrash,
  onSource,
  onQuestionState,
  labels = {},
}) {
  return (
    <article className="card">
      <div className="row spread">
        <span className="pill">
          {t(r.kind)}
          <AnnotationBadge
            value={
              r.annotation ||
              (r.anchor && !r.anchor.pageOnly ? annotationAppearance(r) : null)
            }
            t={t}
            labels={labels}
          />
        </span>
        <span className="muted small">{date(r.createdAt)}</span>
      </div>
      {r.anchor?.quote && <blockquote>{r.anchor.quote}</blockquote>}
      {r.kind === "review" ? (
        <SpiritMessage text={r.body} />
      ) : (
        <p className="recordBody">{r.body}</p>
      )}
      {r.kind === "question" && (
        <div className="row">
          <span className="pill">
            {t(
              r.questionState === "understood"
                ? "questionUnderstood"
                : "questionOpen",
            )}
          </span>
          {onQuestionState && !r.deletedAt && (
            <button
              onClick={() =>
                onQuestionState(
                  r.questionState === "understood" ? "open" : "understood",
                )
              }
            >
              {t(
                r.questionState === "understood"
                  ? "reopenQuestion"
                  : "markUnderstood",
              )}
            </button>
          )}
        </div>
      )}
      <div className="muted small">
        {r.origin === "user" ? t("myRecord") : t("aiRecord")}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {r.anchor && onSource && (
          <button onClick={() => onSource(r.anchor)}>{t("source")}</button>
        )}
        {onEdit && <button onClick={() => onEdit(r)}>{t("edit")}</button>}
        {onTrash && (
          <button onClick={() => onTrash(r)}>
            {t(r.deletedAt ? "restore" : "remove")}
          </button>
        )}
      </div>
      {r.history?.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary>
            {t("versions")} ({r.history.length})
          </summary>
          {r.history.map((v, i) => (
            <div className="card small" key={i}>
              <div>
                {date(v.at)} <AnnotationBadge value={v.annotation} t={t} />
              </div>
              {v.visualOnly ? (
                <small className="muted">{t("visualOnlyVersion")}</small>
              ) : (
                <p className="recordBody">{v.body}</p>
              )}
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
export function Traces(props) {
  return <LearningTraces {...props} RecordCard={RecordCard} />;
}
export function Settings({ data, refresh, t, run, setModal }) {
  const [s, setS] = useState(data.settings),
    [catalog, setCatalog] = useState(null);
  useEffect(() => {
    rpc({ action: "spirit", command: "models" })
      .then(setCatalog)
      .catch(() => {});
  }, []);
  return (
    <div className="scroll page">
      <div className="settings">
        <div className="columns">
          <section className="card form">
            <h2>{t("settings")}</h2>
            <label>
              {t("replyLanguage")}
              <select
                value={s.replyLanguage}
                onChange={(e) => setS({ ...s, replyLanguage: e.target.value })}
              >
                <option value="auto">{t("auto")}</option>
                <option value="zh">简体中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t("model")}
              <select
                value={s.model ? JSON.stringify(s.model) : ""}
                onChange={(e) =>
                  setS({
                    ...s,
                    model: e.target.value ? JSON.parse(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("defaultModel")}</option>
                {catalog?.groups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.models.map((m) => (
                      <option
                        key={m.id}
                        value={JSON.stringify({ provider: g.id, model: m.id })}
                      >
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {[
              ["fontSize", 14, 32, 1],
              ["lineHeight", 1.3, 2.6, 0.1],
              ["pageWidth", 480, 1000, 20],
            ].map(([k, min, max, step]) => (
              <label key={k}>
                {t(k)} · {s[k]}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={s[k]}
                  onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            <button
              className="primary"
              onClick={() =>
                run(async () => {
                  const { replyLength, ...settingsToSave } = s;
                  await rpc({
                    action: "settings",
                    item: settingsToSave,
                    revision: data.revision,
                    requestId: request(),
                  });
                  await refresh();
                })
              }
            >
              {t("save")}
            </button>
          </section>
          <section className="card form">
            <h2>{t("settings")}</h2>
            <p className="muted">{t("backupHint")}</p>
            {[false, true].map((full) => (
              <button
                key={String(full)}
                onClick={() =>
                  run(async () => {
                    const res = await fetch(
                      API + "/backup?originals=" + (full ? "1" : "0"),
                    );
                    if (!res.ok) throw new Error(await res.text());
                    download(
                      await res.arrayBuffer(),
                      "ai-reading-room-" +
                        new Date().toISOString().slice(0, 10) +
                        (full ? "-full" : "") +
                        ".zip",
                      "application/zip",
                    );
                  })
                }
              >
                {t(full ? "fullBackup" : "backup")}
              </button>
            ))}
            <label>
              {t("restoreBackup")}
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f)
                    run(async () => {
                      if (f.size > 192 * 1024 * 1024)
                        throw new Error("FILE_SIZE_LIMIT");
                      const bytes = await base64File(f),
                        summary = await rpc({
                          action: "restorePreview",
                          data: bytes,
                        });
                      setModal({ kind: "restore", bytes, summary });
                    });
                }}
              />
            </label>
            <button
              onClick={() =>
                run(async () => {
                  await rpc({
                    action: "preferences",
                    item: { methodIntro: {} },
                    requestId: request(),
                  });
                  await refresh();
                })
              }
            >
              {t("resetMethodIntros")}
            </button>
            <label>
              {t("showTips")}
              <select
                value={data.preferences?.tips || "all"}
                onChange={(e) =>
                  run(async () => {
                    await rpc({
                      action: "preferences",
                      item: { tips: e.target.value },
                      requestId: request(),
                    });
                    await refresh();
                  })
                }
              >
                <option value="all">{t("allTips")}</option>
                <option value="necessary">{t("necessaryTips")}</option>
                <option value="off">{t("offTips")}</option>
              </select>
            </label>
            <h3>{t("localRoot")}</h3>
            <code style={{ overflowWrap: "anywhere" }}>{data.root}</code>
            <p className="muted small">{t("privacy")}</p>
          </section>
        </div>
        <AnnotationLabels data={data} t={t} run={run} refresh={refresh} />
        <LibrarySettings
          data={data}
          t={t}
          run={run}
          refresh={refresh}
          setModal={setModal}
        />
      </div>
    </div>
  );
}
export function ModalContent({
  modal: m,
  t,
  lang,
  run,
  busy,
  close,
  refresh,
  saveNote,
  date,
  open,
  setInfo,
  data,
}) {
  if (m.kind === "help")
    return (
      <HelpCenter
        t={t}
        lang={lang}
        run={run}
        initialTopic={m.topic || "start"}
        initialQuestion={m.question || ""}
        onSample={async () => {
          const x = await rpc({ action: "sample", requestId: request() });
          await refresh();
          close();
          setTimeout(() => open(x.book.id), 0);
        }}
      />
    );
  if (m.kind === "goto") return <GoTo t={t} m={m} close={close} />;
  if (m.kind === "readingReview")
    return (
      <ReadingReview
        m={m}
        t={t}
        lang={lang}
        close={close}
        saveNote={saveNote}
        labels={data.preferences?.annotationLabels}
      />
    );
  if (m.kind === "methodology")
    return <MethodologyDialog m={m} t={t} lang={lang} close={close} />;
  if (m.kind === "note")
    return (
      <NoteForm
        key={m.record?.id || m.bookId + m.type}
        m={m}
        t={t}
        run={run}
        busy={busy}
        labels={data.preferences?.annotationLabels}
        saveNote={saveNote}
      />
    );
  if (m.kind === "import")
    return (
      <ImportWizard
        t={t}
        run={run}
        busy={busy}
        refresh={refresh}
        close={() => {
          setInfo(null);
          close();
        }}
        open={open}
        initialPath={m.initialPath || ""}
        libraryPath={data?.libraryPath || ""}
      />
    );
  if (m.kind === "search")
    return <SearchForm t={t} m={m} run={run} open={open} close={close} />;
  if (m.kind === "restore")
    return (
      <div className="form">
        <p>{t("restoreWarning")}</p>
        {["books", "records", "exercises", "conflicts"].map((k) => (
          <div key={k}>
            {m.summary[k]} {t(k)}
          </div>
        ))}
        <button
          disabled={busy}
          className="primary"
          onClick={() =>
            run(async () => {
              await rpc({
                action: "restore",
                data: m.bytes,
                confirm: true,
                requestId: request(),
              });
              await refresh();
              close();
            })
          }
        >
          {t("confirmRestore")}
        </button>
      </div>
    );
  if (m.kind === "meta")
    return (
      <MetaForm t={t} book={m.book} run={run} close={close} setInfo={setInfo} />
    );
  return null;
}
function NoteForm({ m, t, run, busy, saveNote, labels }) {
  const key = "arr-draft:" + m.bookId + ":" + (m.record?.id || "new");
  const [body, setBody] = useState(() => {
      try {
        return localStorage.getItem(key) ?? m.body ?? "";
      } catch {
        return m.body || "";
      }
    }),
    [kind, setKind] = useState(m.type || "reflection"),
    [annotation, setAnnotation] = useState(
      m.record
        ? annotationAppearance(m.record)
        : m.annotation || { style: "highlight", color: "yellow" },
    );
  const rid = useRef(request());
  return (
    <div className="form">
      {m.anchor && <blockquote>{m.anchor.quote}</blockquote>}
      {m.anchor && !m.anchor.pageOnly && (
        <AnnotationSwatches
          value={annotation}
          onChange={setAnnotation}
          t={t}
          labels={labels}
        />
      )}
      <label>
        {t("notes")}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={m.record?.kind === "review"}
        >
          {["reflection", "question", "highlight", "note", "ai", "review"].map(
            (k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ),
          )}
        </select>
      </label>
      <textarea
        rows={10}
        value={body}
        placeholder={t("bodyHint")}
        onChange={(e) => {
          setBody(e.target.value);
          try {
            localStorage.setItem(key, e.target.value);
          } catch {}
        }}
      />
      <span className="muted small">{t("draft")}</span>
      <button
        className="primary"
        disabled={busy || (!body.trim() && !m.anchor)}
        onClick={() =>
          run(async () => {
            await saveNote({
              id: m.record?.id,
              bookId: m.bookId,
              revision: m.record?.revision,
              requestId: rid.current,
              item: {
                kind,
                body,
                anchor: m.anchor || null,
                annotation:
                  m.anchor && !m.anchor.pageOnly ? annotation : undefined,
                origin: m.origin || "user",
                discussionId: m.discussionId || "",
              },
            });
            try {
              localStorage.removeItem(key);
            } catch {}
          })
        }
      >
        {t("save")}
      </button>
    </div>
  );
}
function SearchForm({ t, m, run, open, close }) {
  const [q, setQ] = useState(m.query || ""),
    [items, setItems] = useState([]);
  return (
    <div className="form">
      <div className="row">
        <input
          className="grow"
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchText")}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              run(async () =>
                setItems(
                  (await rpc({ action: "search", query: q, id: m.bookId }))
                    .items,
                ),
              );
          }}
        />
        <button
          onClick={() =>
            run(async () =>
              setItems(
                (await rpc({ action: "search", query: q, id: m.bookId })).items,
              ),
            )
          }
        >
          {t("searchText")}
        </button>
      </div>
      {items.map((r, i) => (
        <button
          style={{ textAlign: "left" }}
          key={i}
          onClick={() => {
            if (m.onJump) {
              m.onJump(r);
              close();
            } else {
              try {
                sessionStorage.setItem(
                  "arr-jump:" + r.bookId,
                  JSON.stringify(r),
                );
              } catch {}
              close();
              open(r.bookId);
            }
          }}
        >
          <b>
            {r.bookTitle} · {r.chapterTitle}
          </b>
          <p>{r.snippet}</p>
        </button>
      ))}
    </div>
  );
}
function MetaForm({ t, book: b, run, close, setInfo }) {
  const [title, setTitle] = useState(b.title),
    [author, setAuthor] = useState(b.author),
    [tags, setTags] = useState(b.tags.join(", ")),
    [status, setStatus] = useState(b.status),
    [sourcePath, setSourcePath] = useState(b.sourcePath || ""),
    [notice, setNotice] = useState("");
  return (
    <div className="form">
      <label>
        {t("bookTitle")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        {t("author")}
        <input value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <label>
        {t("tags")}
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <label>
        {t("status")}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["want", "reading", "paused", "finished"].map((k) => (
            <option key={k} value={k}>
              {t(k)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primary"
        onClick={() =>
          run(async () => {
            await rpc({
              action: "saveBook",
              id: b.id,
              revision: b.revision,
              item: {
                title,
                author,
                tags: tags
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
                status,
              },
              requestId: request(),
            });
            setInfo(await rpc({ action: "open", id: b.id }));
            close();
          })
        }
      >
        {t("save")}
      </button>
      <div className="muted">
        {b.format.toUpperCase()} · {Math.round(b.bytes / 1024)} KB
        <br />
        {b.hash}
      </div>
      {b.format === "epub" && (
        <button
          onClick={() =>
            run(async () => {
              const x = await rpc({ action: "repairNavigation", id: b.id });
              setNotice(t(x.repaired ? "repaired" : "navigationWarning"));
              setInfo(await rpc({ action: "open", id: b.id }));
            })
          }
        >
          {t("repairContents")}
        </button>
      )}
      <label>
        {t("relink")}
        <input
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder={t("path")}
        />
      </label>
      <button
        disabled={!sourcePath.trim()}
        onClick={() =>
          run(async () => {
            await rpc({
              action: "relinkBook",
              id: b.id,
              path: sourcePath,
              requestId: request(),
            });
            setInfo(await rpc({ action: "open", id: b.id }));
            setNotice(t("saved"));
          })
        }
      >
        {t("relink")}
      </button>
      {notice && <p role="status">{notice}</p>}
      <button
        onClick={() =>
          run(async () => {
            await rpc({
              action: "trashBook",
              id: b.id,
              revision: b.revision,
              requestId: request(),
            });
            setInfo(null);
            close();
          })
        }
      >
        {t("remove")}
      </button>
    </div>
  );
}
