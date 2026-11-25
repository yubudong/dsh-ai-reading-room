import React, { useEffect, useState } from "react";
import { rpc, request } from "./api.js";
export function MethodPrompt({
  book,
  chapterId,
  anchor,
  method,
  lang,
  t,
  override,
  setOverride,
  preview,
  setPreview,
  includeNotes,
  setIncludeNotes,
  onSave,
  onHelp,
  refreshEpoch = 0,
}) {
  const key = "arr-prompt-display:" + method,
    [display, setDisplay] = useState(() => {
      try {
        return (
          localStorage.getItem(key) ||
          localStorage.getItem("arr-prompt-default") ||
          "full"
        );
      } catch {
        return "full";
      }
    }),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      setDisplay(
        localStorage.getItem(key) ||
          localStorage.getItem("arr-prompt-default") ||
          "full",
      );
    } catch {}
    setEditing(false);
  }, [method]);
  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    setError("");
    rpc(
      {
        action: "methodPreview",
        bookId: book.id,
        chapterId,
        anchor,
        method,
        language: lang,
        override: override ?? undefined,
        includeNotes,
      },
      ac.signal,
    )
      .then((x) => {
        if (active) setPreview(x);
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") {
          setError(e.message);
          setPreview(null);
        }
      });
    return () => {
      active = false;
      ac.abort();
    };
  }, [
    book.id,
    chapterId,
    anchor,
    method,
    lang,
    override,
    includeNotes,
    refreshEpoch,
  ]);
  function choose(value) {
    setDisplay(value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
  return (
    <section className={"arr-prompt-card is-" + display}>
      <div className="row spread">
        <strong>{preview?.name || t("methodPrompt")}</strong>
        <select
          aria-label={t("promptDisplay")}
          value={display}
          onChange={(e) => choose(e.target.value)}
        >
          {[
            ["full", "promptFull"],
            ["compact", "promptCompact"],
            ["hidden", "promptHidden"],
          ].map(([v, k]) => (
            <option value={v} key={v}>
              {t(k)}
            </option>
          ))}
        </select>
      </div>
      {display !== "hidden" && (
        <>
          <p className="muted small">{preview?.description}</p>
          {display === "full" && (
            <>
              <p className="muted small">{t("promptHint")}</p>
              {editing ? (
                <textarea
                  rows={8}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              ) : (
                <pre className="arr-prompt-text">
                  {preview?.prompt || error || t("loading")}
                </pre>
              )}
              <label className="arr-check small">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                {t("includeNotes")}
              </label>
              <div className="row">
                {editing ? (
                  <>
                    <button
                      onClick={() => {
                        setOverride(draft);
                        setEditing(false);
                      }}
                    >
                      {t("save")}
                    </button>
                    <button onClick={() => setEditing(false)}>
                      {t("cancel")}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setDraft(preview?.prompt || "");
                      setEditing(true);
                    }}
                  >
                    {t("editThisPrompt")}
                  </button>
                )}
                {override !== null && (
                  <button onClick={() => setOverride(null)}>
                    {t("resetPrompt")}
                  </button>
                )}
                <button disabled={!preview} onClick={() => onSave(preview)}>
                  {t("saveAsMethod")}
                </button>
                <button
                  disabled={!preview}
                  onClick={() => navigator.clipboard?.writeText(preview.prompt)}
                >
                  {t("copyPrompt")}
                </button>
              </div>
            </>
          )}
          <button className="arr-text-button" onClick={onHelp}>
            {t("learnMethod")}
          </button>
        </>
      )}
    </section>
  );
}
