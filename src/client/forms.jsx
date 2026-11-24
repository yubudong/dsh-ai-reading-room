import React, { useState, useEffect, useRef } from "react";
import {
  rpc,
  API,
  request,
  download,
  base64File,
  localizeError,
} from "./api.js";
export function RecordCard({ r, t, date, onEdit, onTrash, onSource }) {
  return (
    <article className="card">
      <div className="row spread">
        <span className="pill">{t(r.kind)}</span>
        <span className="muted small">{date(r.createdAt)}</span>
      </div>
      {r.anchor?.quote && <blockquote>{r.anchor.quote}</blockquote>}
      <p className="recordBody">{r.body}</p>
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
              <div>{date(v.at)}</div>
              <p className="recordBody">{v.body}</p>
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
export function Traces({
  items,
  data,
  query,
  setQuery,
  t,
  date,
  open,
  run,
  refresh,
  setModal,
}) {
  const [trash, setTrash] = useState(false);
  return (
    <div className="scroll page">
      <div className="toolbar">
        <input
          placeholder={t("noteFilter")}
          aria-label={t("noteFilter")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button aria-selected={trash} onClick={() => setTrash(!trash)}>
          {t("trash")}
        </button>
      </div>
      {items
        .filter(
          (r) =>
            !!r.deletedAt === trash &&
            (r.body + " " + (r.anchor?.quote || "")).includes(query),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => (
          <div key={r.id} style={{ maxWidth: 850, margin: "auto" }}>
            <button className="link" onClick={() => open(r.bookId)}>
              {data.books.find((b) => b.id === r.bookId)?.title || r.bookId}
            </button>
            <RecordCard
              r={r}
              t={t}
              date={date}
              onEdit={(r) =>
                setModal({
                  kind: "note",
                  bookId: r.bookId,
                  record: r,
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
                    restore: !!r.deletedAt,
                    requestId: request(),
                  });
                  await refresh();
                })
              }
            />
          </div>
        ))}
    </div>
  );
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
                  await rpc({
                    action: "settings",
                    item: s,
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
            <h3>{t("localRoot")}</h3>
            <code style={{ overflowWrap: "anywhere" }}>{data.root}</code>
            <p className="muted small">{t("privacy")}</p>
          </section>
        </div>
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
  if (m.kind === "help") return <p>{t("helpText")}</p>;
  if (m.kind === "note")
    return (
      <NoteForm
        key={m.record?.id || m.bookId + m.type}
        m={m}
        t={t}
        run={run}
        busy={busy}
        saveNote={saveNote}
      />
    );
  if (m.kind === "import")
    return <ImportForm t={t} run={run} busy={busy} refresh={refresh} />;
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
function NoteForm({ m, t, run, busy, saveNote }) {
  const key = "arr-draft:" + m.bookId + ":" + (m.record?.id || "new");
  const [body, setBody] = useState(() => {
      try {
        return localStorage.getItem(key) ?? m.body ?? "";
      } catch {
        return m.body || "";
      }
    }),
    [kind, setKind] = useState(m.type || "reflection");
  const rid = useRef(request());
  return (
    <div className="form">
      {m.anchor && <blockquote>{m.anchor.quote}</blockquote>}
      <label>
        {t("notes")}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={!!m.record}
        >
          {["reflection", "question", "highlight", "note", "ai"].map((k) => (
            <option key={k} value={k}>
              {t(k)}
            </option>
          ))}
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
function ImportForm({ t, run, busy, refresh }) {
  const [path, setPath] = useState(""),
    [files, setFiles] = useState([]),
    [result, setResult] = useState([]),
    [encoding, setEncoding] = useState("utf-8");
  const stopped = useRef(false);
  async function upload(list) {
    stopped.current = false;
    for (const f of list) {
      if (stopped.current) break;
      const id = request();
      try {
        const res = await fetch(
          API +
            "/upload?name=" +
            encodeURIComponent(f.name) +
            "&encoding=" +
            encoding +
            "&requestId=" +
            id,
          { method: "POST", body: f },
        );
        const v = await res.json();
        if (!v.ok) throw new Error(v.error);
        setResult((old) => [
          ...old,
          {
            name: f.name,
            state: v.value.duplicate ? t("duplicate") : t("saved"),
          },
        ]);
      } catch (e) {
        setResult((old) => [
          ...old,
          { name: f.name, state: localizeError(e.message, t) },
        ]);
      }
    }
    await refresh();
  }
  return (
    <div
      className="form"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        run(() => upload([...e.dataTransfer.files]));
      }}
    >
      <p>{t("hint")}</p>
      <div className="row">
        <label>
          {t("chooseFiles")}
          <input
            disabled={busy}
            type="file"
            accept=".epub,.pdf,.txt,.md,.markdown"
            multiple
            onChange={(e) => run(() => upload([...e.target.files]))}
          />
        </label>
        <label>
          {t("chooseFolder")}
          <input
            disabled={busy}
            type="file"
            webkitdirectory=""
            multiple
            onChange={(e) =>
              run(() =>
                upload(
                  [...e.target.files].filter((f) =>
                    /\.(epub|pdf|txt|md|markdown)$/i.test(f.name),
                  ),
                ),
              )
            }
          />
        </label>
      </div>
      <label>
        {t("encoding")}
        <select value={encoding} onChange={(e) => setEncoding(e.target.value)}>
          <option value="utf-8">UTF-8 / Auto</option>
          <option value="gb18030">GB18030 / GBK</option>
          <option value="big5">Big5</option>
        </select>
      </label>
      <label>
        {t("path")}
        <input value={path} onChange={(e) => setPath(e.target.value)} />
      </label>
      <div className="row">
        <button
          disabled={busy || !path.trim()}
          onClick={() =>
            run(async () =>
              setFiles((await rpc({ action: "scan", path })).items),
            )
          }
        >
          {t("scan")}
        </button>
        <button
          disabled={busy || !path.trim()}
          onClick={() =>
            run(async () => {
              const v = await rpc({
                action: "importPath",
                path,
                encoding,
                requestId: request(),
              });
              setResult((old) => [
                ...old,
                {
                  name: v.book.title,
                  state: v.duplicate ? t("duplicate") : t("saved"),
                },
              ]);
              await refresh();
            })
          }
        >
          {t("importPath")}
        </button>
      </div>
      {!!files.length && (
        <>
          <p className="muted">{t("directoryHint")}</p>
          <div className="card" style={{ maxHeight: 180, overflow: "auto" }}>
            {files.map((f) => (
              <div key={f.path}>
                <input
                  type="checkbox"
                  checked={f.selected !== false}
                  onChange={(e) =>
                    setFiles((old) =>
                      old.map((x) =>
                        x.path === f.path
                          ? { ...x, selected: e.target.checked }
                          : x,
                      ),
                    )
                  }
                />{" "}
                {f.name}
              </div>
            ))}
          </div>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                stopped.current = false;
                for (const f of files.filter((f) => f.selected !== false)) {
                  if (stopped.current) break;
                  try {
                    const v = await rpc({
                      action: "importPath",
                      path: f.path,
                      encoding,
                      requestId: request(),
                    });
                    setResult((old) => [
                      ...old,
                      {
                        name: f.name,
                        state: v.duplicate ? t("duplicate") : t("saved"),
                      },
                    ]);
                  } catch (e) {
                    setResult((old) => [
                      ...old,
                      { name: f.name, state: localizeError(e.message, t) },
                    ]);
                  }
                }
                await refresh();
              })
            }
          >
            {t("importSelected")}
          </button>
        </>
      )}
      {busy && (
        <button
          onClick={() => {
            stopped.current = true;
          }}
        >
          {t("cancel")}
        </button>
      )}
      {result.length > 0 && (
        <div
          className="card"
          style={{ maxHeight: 240, overflow: "auto" }}
          role="status"
        >
          {result.map((r, i) => (
            <p key={i}>
              {r.name} · {r.state}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
function SearchForm({ t, m, run, open, close }) {
  const [q, setQ] = useState(""),
    [items, setItems] = useState([]);
  return (
    <div className="form">
      <div className="row">
        <input
          className="grow"
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
    [status, setStatus] = useState(b.status);
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
