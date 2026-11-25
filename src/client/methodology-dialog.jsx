import React, { useState, useEffect, useRef } from "react";
import { rpc, request, localizeError } from "./api.js";
import { localMethod } from "../shared/method-library.js";
export function MethodologyDialog({ m, t, lang, close }) {
  const method = m.method,
    base = localMethod(method.prompt, lang),
    draftKey = "arr-method-dialog:" + m.bookId + ":" + method.id;
  const [draft, setDraft] = useState(() => {
      try {
        return localStorage.getItem(draftKey) ?? m.override ?? base;
      } catch {
        return m.override ?? base;
      }
    }),
    [name, setName] = useState(localMethod(method.name, lang)),
    [skip, setSkip] = useState(!!m.preference?.skip),
    [includeNotes, setIncludeNotes] = useState(!!m.includeNotes),
    [preview, setPreview] = useState(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    ready =
      !!preview &&
      preview.template === draft &&
      preview.source?.includeNotes === includeNotes;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const ac = new AbortController();
    setPreview(null);
    const timer = setTimeout(() => {
      rpc(
        {
          action: "methodPreview",
          bookId: m.bookId,
          chapterId: m.chapterId,
          anchor: m.anchor,
          method: method.id,
          language: lang,
          override: draft,
          includeNotes,
        },
        ac.signal,
      )
        .then(setPreview)
        .catch((e) => {
          if (e.name !== "AbortError") setError(localizeError(e.message, t));
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [draft, includeNotes, lang]);
  async function apply(mode) {
    if (pending || !ready) return;
    setPending(true);
    setError("");
    try {
      let picked = method,
        override = draft === base ? null : draft;
      if (mode !== "turn") {
        const x = await rpc({
          action: "saveMethod",
          id: mode === "save" ? method.id : undefined,
          revision: mode === "save" ? method.revision : undefined,
          language: lang,
          item: {
            name:
              (mode === "new" && name.trim() === localMethod(method.name, lang)
                ? name.trim() +
                  (lang === "zh" ? "（我的版本）" : " (my version)")
                : name.trim()) ||
              localMethod(method.name, lang) +
                (lang === "zh" ? "（我的版本）" : " (my version)"),
            description: localMethod(method.description, lang),
            scenario: localMethod(method.scenario, lang),
            usage: localMethod(method.usage, lang),
            prompt: draft,
            enabled: true,
          },
          requestId: request(),
        });
        picked = x.method;
        override = null;
      }
      const pref = await rpc({
        action: "methodIntro",
        id: picked.id,
        item: { skip },
        requestId: request(),
      });
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      if (!alive.current) return;
      await m.onApply({
        method: picked,
        override,
        includeNotes,
        preferences: pref.preferences,
      });
      close();
    } catch (e) {
      setError(localizeError(e.message, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="arr-methodology-dialog form">
      <h2>
        {localMethod(method.name, lang)}
        {method.personalized && (
          <small className="pill">{t("personalVersion")}</small>
        )}
      </h2>
      <p className="muted">{localMethod(method.description, lang)}</p>
      <p className="muted small">{t("methodDialogHint")}</p>
      <section>
        <h3>{t("methodScenario")}</h3>
        <p className="arr-method-instructions">
          {localMethod(method.scenario, lang) ||
            localMethod(method.description, lang)}
        </p>
      </section>
      <section>
        <h3>{t("methodUsage")}</h3>
        <p className="arr-method-instructions">
          {localMethod(method.usage, lang) || t("genericUsage")}
        </p>
      </section>
      <label>
        {t("methodPrompt")}
        <textarea
          rows={10}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            try {
              localStorage.setItem(draftKey, e.target.value);
            } catch {}
          }}
        />
      </label>
      <div className="row">
        {["book", "author", "chapter", "selection", "notes"].map((key) => (
          <button
            key={key}
            onClick={() => {
              const v = draft + " {{" + key + "}}";
              setDraft(v);
              try {
                localStorage.setItem(draftKey, v);
              } catch {}
            }}
          >
            {"{{" + key + "}}"}
          </button>
        ))}
        <button
          onClick={() => {
            setDraft(base);
            try {
              localStorage.removeItem(draftKey);
            } catch {}
          }}
        >
          {t("resetPrompt")}
        </button>
      </div>
      <label className="arr-check">
        <input
          type="checkbox"
          checked={includeNotes}
          onChange={(e) => setIncludeNotes(e.target.checked)}
        />
        {t("includeNotes")}
      </label>
      <details>
        <summary>{t("effectivePrompt")}</summary>
        <pre className="arr-prompt-text">{preview?.prompt || t("loading")}</pre>
      </details>
      <details>
        <summary>{t("methodReferences")}</summary>
        <p>
          {m.bookTitle} · {preview?.variables.chapter}
        </p>
        {m.anchor?.quote && <blockquote>{m.anchor.quote}</blockquote>}
        <p className="muted small">{t("contextHint")}</p>
      </details>
      <label>
        {t("methodSaveName")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="arr-methodology-footer">
        <label className="arr-check">
          <input
            type="checkbox"
            checked={skip}
            onChange={(e) => setSkip(e.target.checked)}
          />
          {t("skipMethodIntro")}
        </label>
        <div className="arr-methodology-actions">
          <button
            className="primary"
            disabled={pending || !ready || !draft.trim()}
            onClick={() => apply("turn")}
          >
            {t("useThisMethod")}
          </button>
          <button
            disabled={pending || !ready || !draft.trim() || !name.trim()}
            onClick={() => apply("save")}
          >
            {t(method.builtin ? "savePersonalVersion" : "saveToMethod")}
          </button>
          <button
            disabled={pending || !ready || !draft.trim()}
            onClick={() => apply("new")}
          >
            {t("saveNewMethod")}
          </button>
          <button disabled={pending} onClick={close}>
            {t("cancel")}
          </button>
        </div>
      </footer>
    </div>
  );
}
