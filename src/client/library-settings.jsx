import React, { useState } from "react";
import { rpc, request } from "./api.js";
export function LibrarySettings({ data, t, run, refresh, setModal }) {
  const [target, setTarget] = useState(""),
    [show, setShow] = useState(false),
    [status, setStatus] = useState("");
  async function pick() {
    try {
      const x = await rpc({ action: "pickDirectory" });
      if (x.path) {
        setTarget(x.path);
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }
  return (
    <section className="card form" style={{ marginTop: 20 }}>
      <h2>{t("libraryFiles")}</h2>
      <label>
        {t("libraryLocation")}
        <code className="arr-path">{data.libraryPath}</code>
      </label>
      <p className="muted">{t("migrationHint")}</p>
      <div className="row">
        <button onClick={() => run(pick)}>{t("changeLocation")}</button>
        <button onClick={() => run(() => rpc({ action: "revealLibrary" }))}>
          {t("openLocation")}
        </button>
        <button
          onClick={() =>
            setModal({ kind: "import", initialPath: data.libraryPath })
          }
        >
          {t("scanLibrary")}
        </button>
        <button onClick={() => setModal({ kind: "import" })}>
          {t("linkFolder")}
        </button>
      </div>
      {show && (
        <div className="form">
          <input
            aria-label={t("libraryLocation")}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={data.libraryPath}
          />
          <button
            disabled={!target.trim()}
            onClick={() =>
              run(async () => {
                const x = await rpc({
                  action: "migrateLibrary",
                  path: target,
                  requestId: request(),
                });
                setStatus(t("saved") + " · " + x.copied);
                setShow(false);
                await refresh();
              })
            }
          >
            {t("confirmMigration")}
          </button>
        </div>
      )}
      <h3>{t("linkedDirectories")}</h3>
      {(data.directories || []).map((d) => (
        <div className="card" key={d.id}>
          <code className="arr-path">{d.path}</code>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              onClick={() =>
                run(async () => {
                  const x = await rpc({
                    action: "refreshDirectory",
                    id: d.id,
                    requestId: request(),
                  });
                  setStatus(
                    x.results.filter((x) => x.book).length +
                      " " +
                      t("books") +
                      " · " +
                      x.results.filter((x) => x.error).length +
                      " " +
                      t("failedCount"),
                  );
                  await refresh();
                })
              }
            >
              {t("rescan")}
            </button>
            <button
              onClick={() =>
                run(async () => {
                  await rpc({
                    action: "removeDirectory",
                    id: d.id,
                    requestId: request(),
                  });
                  await refresh();
                })
              }
            >
              {t("removeLink")}
            </button>
            <label className="arr-check">
              <input
                type="checkbox"
                checked={d.checkOnOpen}
                onChange={(e) =>
                  run(async () => {
                    await rpc({
                      action: "addDirectory",
                      path: d.path,
                      recursive: d.recursive,
                      checkOnOpen: e.target.checked,
                      requestId: request(),
                    });
                    await refresh();
                  })
                }
              />
              {t("checkOnOpen")}
            </label>
          </div>
        </div>
      ))}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
