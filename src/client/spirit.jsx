import React, { useState, useEffect, useRef } from "react";
import { rpc, request, stageNames } from "./api.js";
export function SpiritPanel({
  book,
  chapters,
  chapterId,
  anchor,
  t,
  lang,
  date,
  run,
  onUpdate,
  exercises,
  showNote,
  onJump,
}) {
  const [selected, setSelected] = useState(""),
    [view, setView] = useState(null),
    [method, setMethod] = useState("free"),
    [goal, setGoal] = useState(""),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false),
    [watchError, setWatchError] = useState("");
  const live = useRef(null),
    sendId = useRef(null),
    acRef = useRef(null);
  useEffect(() => {
    if (!selected && exercises.length)
      setSelected(
        [...exercises].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
          .id,
      );
  }, [exercises]);
  useEffect(() => {
    if (!selected) return;
    try {
      setMessage(localStorage.getItem("arr-message:" + selected) || "");
    } catch {}
    let active = true;
    const ac = new AbortController();
    acRef.current = ac;
    setView(null);
    setWatchError("");
    (async () => {
      let v = await rpc(
        { action: "spirit", command: "read", id: selected },
        ac.signal,
      );
      if (!active) return;
      setView(v);
      while (active && !ac.signal.aborted) {
        v = await rpc(
          {
            action: "spirit",
            command: "watch",
            id: selected,
            after: v.version,
          },
          ac.signal,
        );
        if (active) setView(v);
      }
    })().catch((e) => {
      if (active && e.name !== "AbortError") setWatchError(e.message);
    });
    return () => {
      active = false;
      ac.abort();
    };
  }, [selected]);
  useEffect(() => {
    live.current?.scrollIntoView({ block: "end" });
  }, [view?.messages.length, view?.liveText]);
  async function create() {
    if (method !== "free" && !goal.trim()) throw new Error("GOAL_REQUIRED");
    const v = await rpc({
      action: "createExercise",
      bookId: book.id,
      method,
      goal,
      requestId: request(),
    });
    if (goal.trim()) {
      try {
        localStorage.setItem("arr-message:" + v.exercise.id, goal);
      } catch {}
    }
    setSelected(v.exercise.id);
    setCreating(false);
    setGoal("");
    await onUpdate();
  }
  async function change(item) {
    const v = await rpc({
      action: "saveExercise",
      id: selected,
      revision: view.exercise.revision,
      item,
      requestId: request(),
    });
    setView((old) => ({ ...old, exercise: v.exercise }));
    await onUpdate();
  }
  async function send(override) {
    const text = typeof override === "string" ? override : message;
    if (sending || !text.trim()) return;
    setSending(true);
    try {
      const id = override ? request() : sendId.current || request();
      if (!override) sendId.current = id;
      const v = await rpc({
        action: "spirit",
        command: "send",
        id: selected,
        text,
        anchor,
        chapterId,
        language: lang,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        requestId: id,
      });
      setView(v);
      if (!override) {
        setMessage("");
        sendId.current = null;
        try {
          localStorage.removeItem("arr-message:" + selected);
        } catch {}
      }
    } finally {
      setSending(false);
    }
  }
  function renderedText(text) {
    return text.split(/(\[c\d+\])/g).map((part, i) => {
      const m = part.match(/^\[(c\d+)\]$/),
        c =
          m &&
          view?.exercise.citations?.includes(m[1]) &&
          chapters.find((c) => c.id === m[1]);
      return c ? (
        <button
          className="small link"
          key={i}
          title={c.title}
          onClick={() => onJump({ chapterId: c.id, start: 0, end: 1 })}
        >
          {part}
        </button>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
    });
  }
  if (creating || !selected)
    return (
      <div className="sidebody form">
        <p className="muted">{t("noExercise")}</p>
        <div className="methodlist">
          {["free", "hunt", "feynman", "debate"].map((k) => (
            <button
              key={k}
              aria-selected={method === k}
              onClick={() => setMethod(k)}
            >
              <b>{t(k)}</b>
              <span className="muted small">{t(k + "Desc")}</span>
            </button>
          ))}
        </div>
        <label>
          {t("goal")}
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <button className="primary" onClick={() => run(create)}>
          {t("create")}
        </button>
        {selected && (
          <button onClick={() => setCreating(false)}>{t("cancel")}</button>
        )}
      </div>
    );
  const x = view?.exercise;
  return (
    <>
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid var(--dsw-alias-border-l1)",
        }}
      >
        <div className="row">
          <select
            className="grow"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label={t("viewExercise")}
          >
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {t(e.method)} · {e.goal || date(e.createdAt)}
              </option>
            ))}
          </select>
          <button onClick={() => setCreating(true)}>＋</button>
        </div>
        {x && (
          <>
            <p className="small">{x.goal}</p>
            <label className="small">
              {t("stage")}
              <select
                value={Math.min(x.stage, stageNames[x.method][lang].length - 1)}
                onChange={(e) =>
                  run(() => change({ stage: Number(e.target.value) }))
                }
              >
                {stageNames[x.method][lang].map((s, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="row small" style={{ marginTop: 8 }}>
              <span className="pill">
                {t(x.status === "paused" ? "paused" : x.status)}
              </span>
              <button
                onClick={() =>
                  run(() =>
                    change({
                      status: x.status === "active" ? "paused" : "active",
                    }),
                  )
                }
              >
                {t(x.status === "active" ? "pause" : "resume")}
              </button>
              <button
                disabled={x.status === "completed"}
                onClick={() => run(() => change({ status: "completed" }))}
              >
                {t("finish")}
              </button>
              <button
                disabled={view.busy || x.status !== "active"}
                onClick={() => run(() => send(t("recapRequest")))}
              >
                {t("summarize")}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="sidebody">
        {watchError && (
          <div role="alert" className="error">
            {watchError}
            <button
              onClick={() => {
                setSelected("");
                setTimeout(() => setSelected(selected), 0);
              }}
            >
              {t("retry")}
            </button>
          </div>
        )}
        {view?.error && <p className="error">{view.error}</p>}
        {!view ? (
          <p>{t("loading")}</p>
        ) : (
          <>
            {view.messages.map((m) => (
              <article key={m.id} className={"message " + m.role}>
                <div className="row spread small muted">
                  <b>{m.role === "user" ? t("myRecord") : t("spirit")}</b>
                  <span>{date(m.time)}</span>
                </div>
                <div className="messageBody">{renderedText(m.text)}</div>
                {m.role === "assistant" && (
                  <button
                    className="small"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      showNote(book.id, "ai", null, m.text, "ai", selected)
                    }
                  >
                    {t("saveReply")}
                  </button>
                )}
              </article>
            ))}
            {view.liveText && (
              <div className="message">
                <b>{t("spirit")}</b>
                <div className="messageBody">{renderedText(view.liveText)}</div>
              </div>
            )}
            {view.outcome && view.outcome.kind !== "completed" && (
              <p className="error">
                {view.outcome.error?.message || view.outcome.kind}
              </p>
            )}
            <div ref={live} />
          </>
        )}
      </div>
      <div className="compose">
        <details className="small muted">
          <summary>
            {t("scope")} · {t(anchor ? "selection" : "noSelection")}
          </summary>
          <p>{t("contextHint")}</p>
          {anchor && <blockquote>{anchor.quote}</blockquote>}
        </details>
        {x && x.status !== "active" && (
          <p className="small muted">{t("pausedHint")}</p>
        )}
        <textarea
          rows={3}
          value={message}
          disabled={x?.status !== "active"}
          placeholder={t("message")}
          onChange={(e) => {
            setMessage(e.target.value);
            sendId.current = null;
            try {
              localStorage.setItem("arr-message:" + selected, e.target.value);
            } catch {}
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              run(send);
            }
          }}
        />
        <div className="row spread" style={{ marginTop: 7 }}>
          <span className="small muted">⌘ / Ctrl + Enter</span>
          {view?.busy ? (
            <button
              onClick={() =>
                run(async () =>
                  setView(
                    await rpc({
                      action: "spirit",
                      command: "cancel",
                      id: selected,
                    }),
                  ),
                )
              }
            >
              {t("stop")}
            </button>
          ) : (
            <button
              className="primary"
              disabled={sending || !message.trim() || x?.status !== "active"}
              onClick={() => run(send)}
            >
              {t("send")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
