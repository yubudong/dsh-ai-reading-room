import React, { useState, useRef } from "react";
import { rpc, API, request, localizeError } from "./api.js";
export function ImportWizard({
  t,
  run,
  busy,
  refresh,
  close,
  open,
  initialPath = "",
  libraryPath = "",
}) {
  const [mode, setMode] = useState(initialPath ? "folder" : "files"),
    [path, setPath] = useState(initialPath),
    [recursive, setRecursive] = useState(true),
    [checkOnOpen, setCheckOnOpen] = useState(false),
    [items, setItems] = useState([]),
    [results, setResults] = useState([]),
    [done, setDone] = useState(false),
    [encoding, setEncoding] = useState("utf-8");
  const stop = useRef(false);
  async function finish(list, selectedMode = mode) {
    stop.current = false;
    setDone(false);
    const output = [];
    let dir = null;
    if (selectedMode === "linked") {
      dir = (
        await rpc({
          action: "addDirectory",
          path,
          recursive,
          checkOnOpen,
          excludedPaths: items
            .filter((x) => x.selected === false)
            .map((x) => x.path),
          requestId: request(),
        })
      ).directory;
    }
    for (const f of list) {
      if (stop.current) break;
      try {
        let v;
        if (f.file) {
          const r = await fetch(
            API +
              "/upload?name=" +
              encodeURIComponent(f.name) +
              "&encoding=" +
              encoding +
              "&requestId=" +
              request(),
            { method: "POST", body: f.file },
          );
          const d = await r.json();
          if (!d.ok) throw new Error(d.error);
          v = d.value;
        } else
          v = await rpc({
            action: "importPath",
            path: f.path,
            encoding,
            link: selectedMode === "linked",
            directoryId: dir?.id,
            requestId: request(),
          });
        output.push({
          ...f,
          file: undefined,
          bookId: v.book.id,
          title: v.book.title,
          status: v.duplicate ? "duplicate" : "success",
        });
      } catch (e) {
        output.push({
          ...f,
          status: "failed",
          error: localizeError(e.message, t),
        });
      }
      setResults([...output]);
    }
    setDone(true);
    await refresh();
  }
  async function choose() {
    try {
      const v = await rpc({ action: "pickDirectory" });
      if (v.path) setPath(v.path);
    } catch {
      inputRef.current?.focus();
    }
  }
  const inputRef = useRef(null),
    ok = results.filter((x) => x.status !== "failed"),
    bad = results.filter((x) => x.status === "failed");
  if (done)
    return (
      <div className="form">
        <h3>{t("importDone")}</h3>
        <div className="row">
          {[
            ["successCount", "success"],
            ["duplicateCount", "duplicate"],
            ["failedCount", "failed"],
          ].map(([label, status]) => (
            <span className="pill" key={status}>
              {t(label)} · {results.filter((x) => x.status === status).length}
            </span>
          ))}
        </div>
        <div className="arr-import-results">
          {results.map((x, i) => (
            <div className="card row spread" key={i}>
              <span className="grow">
                {x.title || x.name}
                <small className="muted">
                  {" "}
                  ·{" "}
                  {x.status === "failed"
                    ? x.error
                    : t(x.status === "duplicate" ? "duplicate" : "saved")}
                </small>
              </span>
              {x.bookId && (
                <button
                  onClick={() => {
                    close();
                    open(x.bookId);
                  }}
                >
                  {t("openBook")}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="row">
          {ok.length === 1 ? (
            <button
              className="primary"
              onClick={() => {
                close();
                open(ok[0].bookId);
              }}
            >
              {t("startReading")}
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                close();
              }}
            >
              {t("viewImported")}
            </button>
          )}
          <button onClick={close}>{t("back")}</button>
          <button
            onClick={() => {
              setDone(false);
              setResults([]);
              setItems([]);
            }}
          >
            {t("continueImport")}
          </button>
          {bad.length > 0 && (
            <button onClick={() => run(() => finish(bad))}>
              {t("retryFailed")}
            </button>
          )}
        </div>
      </div>
    );
  return (
    <div
      className="form"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setMode("files");
        run(() =>
          finish(
            [...e.dataTransfer.files].map((file) => ({
              name: file.name,
              file,
            })),
            "files",
          ),
        );
      }}
    >
      <div className="row">
        {[
          ["files", "importFiles"],
          ["folder", "importFolder"],
          ["linked", "linkFolder"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-selected={mode === key}
            disabled={busy}
            onClick={() => {
              setMode(key);
              setItems([]);
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <p className="muted">
        {t(mode === "linked" ? "linkedHint" : "managedHint")}
        {mode !== "linked" && libraryPath && (
          <small className="arr-path">
            {t("libraryLocation")}：{libraryPath}
          </small>
        )}
      </p>
      {mode === "files" ? (
        <label>
          {t("chooseFiles")}
          <input
            disabled={busy}
            type="file"
            accept=".epub,.pdf,.txt,.md,.markdown"
            multiple
            onChange={(e) =>
              run(() =>
                finish(
                  [...e.target.files].map((file) => ({
                    name: file.name,
                    file,
                  })),
                ),
              )
            }
          />
        </label>
      ) : (
        <>
          <label>
            {t("path")}
            <div className="row">
              <input
                ref={inputRef}
                className="grow"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
              <button disabled={busy} onClick={() => run(choose)}>
                {t("chooseDirectory")}
              </button>
            </div>
          </label>
          <label className="arr-check">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
            />
            {t("includeSubfolders")}
          </label>
          {mode === "linked" && (
            <label className="arr-check">
              <input
                type="checkbox"
                checked={checkOnOpen}
                onChange={(e) => setCheckOnOpen(e.target.checked)}
              />
              {t("checkOnOpen")}
            </label>
          )}
          <button
            disabled={busy || !path.trim()}
            onClick={() =>
              run(async () => {
                const s = await rpc({ action: "scan", path, recursive });
                setItems(s.items);
                if (!s.items.length)
                  setResults([
                    { name: "", status: "failed", error: t("emptyScan") },
                  ]);
              })
            }
          >
            {t("scanPreview")}
          </button>
          <div className="arr-import-results">
            {items.map((f, i) => (
              <label className="arr-check" key={f.path}>
                <input
                  type="checkbox"
                  checked={f.selected !== false}
                  onChange={(e) =>
                    setItems((old) =>
                      old.map((x, n) =>
                        n === i ? { ...x, selected: e.target.checked } : x,
                      ),
                    )
                  }
                />
                <span>{f.relative || f.name}</span>
              </label>
            ))}
          </div>
          {items.length > 0 && (
            <button
              className="primary"
              disabled={busy || !items.some((x) => x.selected !== false)}
              onClick={() =>
                run(() => finish(items.filter((x) => x.selected !== false)))
              }
            >
              {t("importSelected")}
            </button>
          )}
        </>
      )}
      <details>
        <summary>{t("advanced")}</summary>
        <label>
          {t("encoding")}
          <select
            value={encoding}
            onChange={(e) => setEncoding(e.target.value)}
          >
            <option value="utf-8">UTF-8 / Auto</option>
            <option value="gb18030">GB18030 / GBK</option>
            <option value="big5">Big5</option>
          </select>
        </label>
      </details>
      {busy && (
        <button
          onClick={() => {
            stop.current = true;
          }}
        >
          {t("cancel")}
        </button>
      )}
      {results.length > 0 && (
        <div role="status">
          {results.map((x, i) => (
            <p key={i}>
              {x.name} ·{" "}
              {x.error || t(x.status === "duplicate" ? "duplicate" : "saved")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
