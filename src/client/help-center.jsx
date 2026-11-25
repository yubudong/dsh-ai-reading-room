import React, { useState, useEffect, useRef } from "react";
import { MANUAL, MANUAL_VERSION, manualSearch } from "../shared/manual.js";
import {
  SHORTCUTS,
  KEY_STORE,
  shortcutConfig,
  keyLabel,
  chord,
  reserved,
} from "../shared/shortcuts.js";
import { rpc } from "./api.js";
import { SpiritPanel } from "./spirit.jsx";
export function ShortcutReference({ t, lang }) {
  const [overrides, setOverrides] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(KEY_STORE) || "{}");
      } catch {
        return {};
      }
    }),
    [recording, setRecording] = useState(""),
    [error, setError] = useState("");
  const input = useRef(null);
  const mac = /Mac/.test(navigator.platform);
  useEffect(() => {
    if (recording) input.current?.focus();
  }, [recording]);
  function save(next) {
    setOverrides(next);
    localStorage.setItem(KEY_STORE, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("arr-shortcuts-change"));
  }
  return (
    <section className="form">
      <h2>{t("shortcuts")}</h2>
      <p className="muted">{t("keyboardScope")}</p>
      {error && <p className="error">{error}</p>}
      {recording && (
        <input
          ref={input}
          readOnly
          placeholder={t("pressKey")}
          aria-label={t("pressKey")}
          onKeyDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") {
              setRecording("");
              return;
            }
            if (
              e.isComposing ||
              ["Control", "Meta", "Alt", "Shift"].includes(e.key)
            )
              return;
            const k = chord(e),
              conflict = shortcutConfig(overrides).some(
                (x) => x.id !== recording && x.keys.includes(k),
              );
            if (reserved(k) || conflict) {
              setError(t("shortcutConflict"));
              return;
            }
            save({ ...overrides, [recording]: [k] });
            setRecording("");
            setError("");
          }}
        />
      )}
      <table>
        <thead>
          <tr>
            <th>{t("shortcutAction")}</th>
            <th>{t("shortcutKeys")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shortcutConfig(overrides).map((s) => (
            <tr key={s.id}>
              <td>{s[lang]}</td>
              <td>{s.keys.map((k) => keyLabel(k, mac)).join(" / ") || "—"}</td>
              <td>
                <button onClick={() => setRecording(s.id)}>
                  {t("recordKey")}
                </button>{" "}
                <button onClick={() => save({ ...overrides, [s.id]: [] })}>
                  {t("disableKey")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => {
          save({});
          setError("");
        }}
      >
        {t("resetKeys")}
      </button>
    </section>
  );
}
export function HelpCenter({
  t,
  lang,
  run,
  onSample,
  initialTopic = "start",
  initialQuestion = "",
}) {
  const [topic, setTopic] = useState(initialTopic),
    [query, setQuery] = useState(""),
    [chat, setChat] = useState(!!initialQuestion),
    [exercises, setExercises] = useState([]),
    [hint, setHint] = useState(initialQuestion),
    [signal, setSignal] = useState(0);
  async function update() {
    setExercises(
      (await rpc({ action: "exerciseList", bookId: "__help__" })).items,
    );
  }
  useEffect(() => {
    update().catch(() => {});
  }, []);
  const hits = manualSearch(query, lang),
    article = MANUAL.find((x) => x.id === topic) || hits[0] || MANUAL[0];
  return (
    <div className="arr-help-layout">
      <aside className="arr-help-nav">
        <h2>{t("help")}</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("helpSearch")}
          aria-label={t("helpSearch")}
        />
        {hits.map((x) => (
          <button
            key={x.id}
            aria-selected={topic === x.id}
            onClick={() => setTopic(x.id)}
          >
            {x.title[lang]}
          </button>
        ))}
        <button onClick={() => setTopic("keys")}>{t("shortcuts")}</button>
        <small className="muted">v{MANUAL_VERSION}</small>
      </aside>
      <main className="arr-help-article">
        {topic === "keys" ? (
          <ShortcutReference t={t} lang={lang} />
        ) : (
          <>
            <h2>{article.title[lang]}</h2>
            <div className="arr-guide-body">
              {article.body[lang].split(/。\s*/).map((p, i) => (
                <p key={i}>
                  {p}
                  {lang === "zh" && p ? "。" : ""}
                </p>
              ))}
            </div>
            {article.id === "start" && onSample && (
              <button onClick={() => run(onSample)}>{t("trySample")}</button>
            )}
            <button
              onClick={() => {
                setHint(
                  (lang === "zh"
                    ? "请依据使用手册解释："
                    : "Explain this guide section: ") + article.title[lang],
                );
                setSignal((x) => x + 1);
                setChat(true);
              }}
            >
              {t("helpBookworm")}
            </button>
          </>
        )}
      </main>
      {chat && (
        <aside className="arr-help-chat">
          <SpiritPanel
            book={{ id: "__help__", title: t("usageHelp") }}
            chapters={[]}
            chapterId=""
            anchor={null}
            t={t}
            lang={lang}
            date={(v) =>
              new Date(v).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")
            }
            run={run}
            onUpdate={update}
            exercises={exercises}
            showNote={() => {}}
            onJump={() => {}}
            helpOnly={true}
            initialMessage={hint}
            focusSignal={signal}
          />
        </aside>
      )}
    </div>
  );
}
