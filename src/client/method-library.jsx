import React, { useState, useEffect } from "react";
import { rpc, request, download } from "./api.js";
import { localMethod } from "../shared/method-library.js";
export function MethodLibrary({
  t,
  lang,
  run,
  refreshEpoch = 0,
  onChoose,
  onSuggest,
}) {
  const [items, setItems] = useState([]),
    [editing, setEditing] = useState(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [prompt, setPrompt] = useState(""),
    [scenario, setScenario] = useState(""),
    [usage, setUsage] = useState(""),
    [query, setQuery] = useState(""),
    [favorites, setFavorites] = useState([]);
  async function load() {
    const x = await rpc({ action: "methods" });
    setItems(x.items);
    setFavorites(x.favorites || []);
  }
  useEffect(() => {
    load().catch(() => {});
  }, [refreshEpoch]);
  function edit(m, copy = false) {
    setEditing(copy || !m ? {} : m);
    setName(
      m
        ? localMethod(m.name, lang) +
            (copy ? (lang === "zh" ? "（我的版本）" : " (my version)") : "")
        : "",
    );
    setDescription(m ? localMethod(m.description, lang) : "");
    setPrompt(m ? localMethod(m.prompt, lang) : "");
    setScenario(m ? localMethod(m.scenario, lang) : "");
    setUsage(m ? localMethod(m.usage, lang) : "");
  }
  if (editing)
    return (
      <section className="card form">
        <h2>{t(editing.id ? "editMethodology" : "newMethod")}</h2>
        <label>
          {t("methodName")}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t("methodDescription")}
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          {t("methodScenario")}
          <textarea
            rows={3}
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          />
        </label>
        <label>
          {t("methodUsage")}
          <textarea
            rows={4}
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
          />
        </label>
        <label>
          {t("methodPrompt")}
          <textarea
            rows={12}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <div className="row">
          <span>{t("insertVariable")}</span>
          {["book", "author", "chapter", "selection", "notes"].map((key) => (
            <button
              key={key}
              onClick={() => setPrompt((p) => p + " {{" + key + "}}")}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="row">
          <button
            className="primary"
            disabled={!name.trim() || !prompt.trim()}
            onClick={() =>
              run(async () => {
                await rpc({
                  action: "saveMethod",
                  id: editing.id,
                  revision: editing.revision,
                  language: lang,
                  item: {
                    name,
                    description,
                    prompt,
                    scenario,
                    usage,
                    enabled: true,
                  },
                  requestId: request(),
                });
                await load();
                setEditing(null);
              })
            }
          >
            {t("save")}
          </button>
          <button onClick={() => setEditing(null)}>{t("cancel")}</button>
          {onSuggest && (
            <button disabled={!prompt.trim()} onClick={() => onSuggest(prompt)}>
              {t("suggestMethod")}
            </button>
          )}
        </div>
        {onSuggest && <p className="muted small">{t("suggestionHint")}</p>}
      </section>
    );
  return (
    <div className="form">
      <div className="row spread">
        <h2>{t("methodLibrary")}</h2>
        <div className="row">
          <button onClick={() => edit(null)}>{t("newMethod")}</button>
          <button
            onClick={() =>
              run(async () => {
                const x = await rpc({ action: "exportMethods" });
                download(
                  JSON.stringify(x, null, 2),
                  "reading-methods.json",
                  "application/json",
                );
              })
            }
          >
            {t("exportMethods")}
          </button>
          <label>
            {t("importMethods")}
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file)
                  run(async () => {
                    if (file.size > 3 * 1024 * 1024)
                      throw new Error("FILE_SIZE_LIMIT");
                    await rpc({
                      action: "importMethods",
                      item: JSON.parse(await file.text()),
                      requestId: request(),
                    });
                    await load();
                  });
              }}
            />
          </label>
        </div>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("methodSearch")}
      />
      {items
        .filter(
          (m) =>
            m.id !== "free" &&
            (localMethod(m.name, lang) + " " + localMethod(m.description, lang))
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .map((m) => (
          <section className="card" key={m.id}>
            <div className="row spread">
              <h3>
                {localMethod(m.name, lang)}{" "}
                {m.personalized && (
                  <small className="pill">{t("personalVersion")}</small>
                )}
              </h3>
              <button
                aria-pressed={favorites.includes(m.id)}
                title={t(
                  favorites.includes(m.id)
                    ? "unfavoriteMethod"
                    : "favoriteMethod",
                )}
                onClick={() =>
                  run(async () => {
                    const next = favorites.includes(m.id)
                      ? favorites.filter((id) => id !== m.id)
                      : [...favorites, m.id];
                    await rpc({
                      action: "preferences",
                      item: { methodFavorites: next },
                      requestId: request(),
                    });
                    await load();
                  })
                }
              >
                {favorites.includes(m.id) ? "★" : "☆"}
              </button>
              {onChoose && m.enabled && (
                <button onClick={() => onChoose(m.id)}>{t("view")}</button>
              )}
            </div>
            <p className="muted">{localMethod(m.description, lang)}</p>
            <details>
              <summary>
                {t("methodScenario")} · {t("methodUsage")}
              </summary>
              <p className="arr-method-instructions">
                {localMethod(m.scenario, lang) ||
                  localMethod(m.description, lang)}
              </p>
              <p className="arr-method-instructions">
                {localMethod(m.usage, lang) || t("genericUsage")}
              </p>
            </details>
            <details>
              <summary>{t("methodPrompt")}</summary>
              <pre className="arr-prompt-text">
                {localMethod(m.prompt, lang)}
              </pre>
            </details>
            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={() => edit(m)}>{t("edit")}</button>
              <button onClick={() => edit(m, true)}>{t("copyMethod")}</button>
              {m.builtin && m.personalized && (
                <button
                  onClick={() =>
                    run(async () => {
                      await rpc({
                        action: "resetMethod",
                        id: m.id,
                        revision: m.revision,
                        language: lang,
                        requestId: request(),
                      });
                      await load();
                    })
                  }
                >
                  {t("restoreBuiltin")}
                </button>
              )}
              <button
                title={t("moveUp")}
                onClick={() =>
                  run(async () => {
                    await rpc({
                      action: "moveMethod",
                      id: m.id,
                      item: { direction: -1 },
                      requestId: request(),
                    });
                    await load();
                  })
                }
              >
                ↑
              </button>
              <button
                title={t("moveDown")}
                onClick={() =>
                  run(async () => {
                    await rpc({
                      action: "moveMethod",
                      id: m.id,
                      item: { direction: 1 },
                      requestId: request(),
                    });
                    await load();
                  })
                }
              >
                ↓
              </button>
              {!m.builtin && (
                <>
                  <button
                    onClick={() =>
                      run(async () => {
                        if (m.enabled)
                          await rpc({
                            action: "removeMethod",
                            id: m.id,
                            revision: m.revision,
                            requestId: request(),
                          });
                        else
                          await rpc({
                            action: "saveMethod",
                            id: m.id,
                            revision: m.revision,
                            item: {
                              name: m.name,
                              description: m.description,
                              prompt: m.prompt,
                              enabled: true,
                            },
                            requestId: request(),
                          });
                        await load();
                      })
                    }
                  >
                    {t(m.enabled ? "disableMethod" : "enableMethod")}
                  </button>
                </>
              )}
            </div>
            {m.history?.length > 0 && (
              <details>
                <summary>
                  {t("methodVersionHistory")} · {m.history.length}
                </summary>
                {[...m.history].reverse().map((v, i) => (
                  <div className="card" key={i}>
                    <small>
                      {v.at} · v{v.revision}
                    </small>
                    <pre className="arr-prompt-text">{v.prompt}</pre>
                    <button
                      onClick={() => {
                        edit(m);
                        setPrompt(v.prompt);
                      }}
                    >
                      {t("editFromVersion")}
                    </button>
                  </div>
                ))}
              </details>
            )}
          </section>
        ))}
    </div>
  );
}
