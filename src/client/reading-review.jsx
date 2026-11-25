import React, { useState, useEffect, useRef } from "react";
import { rpc, request, localizeError } from "./api.js";
import { SpiritMessage } from "./spirit-message.jsx";
import { REVIEW_PROMPT } from "../shared/reading-review.js";
function localTime(value) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function ReadingReview({ m, t, lang, close, saveNote }) {
  const key =
      "arr-review-draft:" +
      m.bookId +
      ":" +
      m.since +
      ":" +
      (m.discussionId || "new"),
    initial = useRef(null);
  if (initial.current === null) {
    try {
      initial.current = JSON.parse(localStorage.getItem(key) || "null") || {};
    } catch {
      initial.current = {};
    }
  }
  const [source, setSource] = useState(null),
    [body, setBody] = useState(initial.current.body || ""),
    [since, setSince] = useState(initial.current.since || m.since),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [suggestion, setSuggestion] = useState(""),
    [containsAI, setContainsAI] = useState(!!initial.current.containsAI),
    [reviewId, setReviewId] = useState(m.discussionId || ""),
    [generationRequest, setGenerationRequest] = useState(""),
    [undo, setUndo] = useState(null);
  const active = useRef(true),
    cancelWatch = useRef(null),
    saveId = useRef(request());
  useEffect(() => {
    active.current = true;
    rpc({
      action: "reviewPreview",
      bookId: m.bookId,
      chapterId: m.chapterId,
      discussionId: m.discussionId || "",
      since: initial.current.since || m.since,
      language: lang,
      location: m.location,
    })
      .then((x) => {
        if (!active.current) return;
        setSource(x.source);
        if (!initial.current.body) setBody(x.draft);
      })
      .catch((e) => active.current && setError(localizeError(e.message, t)));
    return () => {
      active.current = false;
      cancelWatch.current?.abort();
    };
  }, []);
  function edit(value) {
    setBody(value);
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          body: value,
          since: source?.since || since,
          containsAI,
        }),
      );
    } catch {}
  }
  async function rebuild() {
    if (pending) return;
    setError("");
    try {
      const x = await rpc({
        action: "reviewPreview",
        bookId: m.bookId,
        chapterId: m.chapterId,
        discussionId: m.discussionId || "",
        since,
        language: lang,
        location: m.location,
      });
      setUndo({ body, source, containsAI, since: source?.since });
      setSource(x.source);
      setBody(x.draft);
      setContainsAI(false);
      setSuggestion("");
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ body: x.draft, since, containsAI: false }),
        );
      } catch {}
    } catch (e) {
      setError(localizeError(e.message, t));
    }
  }
  async function generate() {
    if (pending || !source) return;
    setPending(true);
    setError("");
    setSuggestion("");
    const ac = new AbortController();
    cancelWatch.current = ac;
    try {
      let id = reviewId;
      if (!id) {
        id = (
          await rpc({
            action: "createExercise",
            bookId: m.bookId,
            method: "free",
            item: { model: m.model || null },
            requestId: request(),
          })
        ).exercise.id;
        setReviewId(id);
      }
      const before = await rpc({ action: "spirit", command: "read", id });
      if (before.busy) throw new Error("SPIRIT_BUSY");
      const old = new Set(before.messages.map((x) => x.id));
      const requestId = request();
      setGenerationRequest(requestId);
      let v = await rpc(
        {
          action: "spirit",
          command: "send",
          id,
          text:
            lang === "zh"
              ? "请按已展示的取材范围整理本次阅读回顾草稿，明确区分我自己的表达与 AI 建议。"
              : "Organize a draft review from the shown source scope; distinguish my words from AI suggestions.",
          method: before.exercise.method,
          review: true,
          reviewSince: source.since,
          reviewUntil: source.until,
          reviewLocation: m.location,
          chapterId: m.chapterId,
          uiLanguage: lang,
          requestId,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        ac.signal,
      );
      if (active.current) await m.onUpdate?.();
      while (active.current && !ac.signal.aborted) {
        const reply = [...v.messages]
          .reverse()
          .find((x) => x.role === "assistant" && !old.has(x.id));
        setSuggestion(v.liveText || reply?.text || "");
        if (!v.busy) break;
        v = await rpc(
          { action: "spirit", command: "watch", id, after: v.version },
          ac.signal,
        );
      }
      if (v.error) setError(localizeError(v.error, t));
    } catch (e) {
      if (e.name !== "AbortError" && active.current)
        setError(localizeError(e.message, t));
    } finally {
      if (active.current) setPending(false);
    }
  }
  async function save() {
    if (!source || pending) return;
    setError("");
    try {
      let anchor = null;
      if (m.location?.mode === "text" && m.location.quote)
        anchor = {
          chapterId: m.location.chapterId,
          start: m.location.textOffset,
          end: m.location.textOffset + m.location.quote.length,
          quote: m.location.quote,
        };
      else if (m.location?.mode === "pdf")
        anchor = {
          chapterId: m.location.chapterId,
          start: 0,
          end: 0,
          quote: "",
          pageOnly: true,
        };
      await saveNote({
        bookId: m.bookId,
        requestId: saveId.current,
        item: {
          kind: "review",
          body,
          anchor,
          annotation:
            anchor && !anchor.pageOnly
              ? { style: "none", color: "yellow" }
              : undefined,
          origin: containsAI ? "edited-ai" : "user",
          discussionId: reviewId,
          reviewMeta: {
            since: source.since,
            until: source.until,
            chapterId: source.chapterId,
            discussionId: reviewId,
            recordIds: source.savedRecords.map((r) => r.id),
            readerMessageIds: source.readerStatements.map((r) => r.id),
            assistantMessageIds: source.assistantSuggestions.map((r) => r.id),
            containsAiSuggestion: containsAI,
            requestId: containsAI ? generationRequest : "",
          },
        },
      });
      try {
        localStorage.removeItem(key);
      } catch {}
      close();
    } catch (e) {
      setError(localizeError(e.message, t));
    }
  }
  return (
    <div className="arr-reading-review form">
      <p className="muted">{t("reviewHint")}</p>
      {!source && <p>{t("loading")}</p>}
      {source && (
        <>
          <details>
            <summary>
              {t("reviewScope")} · {source.readerStatements.length}{" "}
              {t("readerWords")} / {source.savedRecords.length} {t("records")}
            </summary>
            <p>
              {source.bookTitle} · {new Date(source.since).toLocaleString()} →{" "}
              {new Date(source.until).toLocaleString()}
            </p>
            {source.truncated && <p>{t("reviewTruncated")}</p>}
            <p>{t("reviewScopeHint")}</p>
            <details>
              <summary>{t("reviewMaterials")}</summary>
              <div className="arr-review-materials">
                <h4>{t("readerWords")}</h4>
                {source.readerStatements.map((r) => (
                  <blockquote key={r.id}>{r.text}</blockquote>
                ))}
                <h4>{t("records")}</h4>
                {source.savedRecords.map((r) => (
                  <article key={r.id}>
                    <small>
                      {t(r.kind)} ·{" "}
                      {t(r.origin === "user" ? "myRecord" : "aiRecord")}
                    </small>
                    <p className="recordBody">{r.body || r.anchor?.quote}</p>
                  </article>
                ))}
                <h4>{t("reviewAiReferences")}</h4>
                {source.assistantSuggestions.map((r) => (
                  <blockquote key={r.id}>
                    {r.text}
                    {r.interrupted && <small>{t("replyStopped")}</small>}
                  </blockquote>
                ))}
                {source.currentExcerpt && (
                  <>
                    <h4>{source.currentExcerpt.title}</h4>
                    <pre className="arr-prompt-text">
                      {source.currentExcerpt.text}
                    </pre>
                  </>
                )}
              </div>
            </details>
            <label>
              {t("reviewSince")}
              <input
                type="datetime-local"
                value={localTime(since)}
                disabled={pending}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (Number.isFinite(date.getTime()))
                    setSince(date.toISOString());
                }}
              />
            </label>
            <button disabled={pending} onClick={rebuild}>
              {t("rebuildReview")}
            </button>
            {undo && (
              <button
                onClick={() => {
                  setBody(undo.body);
                  setSource(undo.source);
                  setContainsAI(undo.containsAI);
                  setSince(undo.since);
                  try {
                    localStorage.setItem(
                      key,
                      JSON.stringify({
                        body: undo.body,
                        since: undo.since,
                        containsAI: undo.containsAI,
                      }),
                    );
                  } catch {}
                  setUndo(null);
                }}
              >
                {t("restorePreviousDraft")}
              </button>
            )}
          </details>
          <label>
            {t("reviewDraft")}
            <textarea
              rows={15}
              value={body}
              onChange={(e) => edit(e.target.value)}
            />
          </label>
          <div className="row">
            <button disabled={pending} onClick={generate}>
              {t("generateReview")}
            </button>
            {pending && (
              <button
                onClick={() =>
                  rpc({
                    action: "spirit",
                    command: "cancel",
                    id: reviewId,
                  }).catch((e) => setError(e.message))
                }
              >
                {t("stop")}
              </button>
            )}
          </div>
          <details>
            <summary>{t("reviewModelPrompt")}</summary>
            <pre className="arr-prompt-text">{REVIEW_PROMPT}</pre>
          </details>
          {suggestion && (
            <section className="card">
              <h3>{t("reviewAiDraft")}</h3>
              <SpiritMessage text={suggestion} />
              <button
                disabled={pending}
                onClick={() => {
                  const next =
                    body + "\n\n## " + t("reviewAiDraft") + "\n\n" + suggestion;
                  setContainsAI(true);
                  setBody(next);
                  try {
                    localStorage.setItem(
                      key,
                      JSON.stringify({
                        body: next,
                        since: source.since,
                        containsAI: true,
                      }),
                    );
                  } catch {}
                }}
              >
                {t("insertReviewSuggestion")}
              </button>
            </section>
          )}
          <p className="muted small">{t("reviewNoTask")}</p>
          <div className="row">
            <button
              className="primary"
              disabled={pending || !body.trim()}
              onClick={save}
            >
              {t("saveReview")}
            </button>
            <button onClick={close}>{t("close")}</button>
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
