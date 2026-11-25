import React, { useState, useEffect, useRef } from "react";
import { rpc, request, localizeError } from "./api.js";
import { METHOD_IDS } from "../shared/reading-methods.js";
import { SpiritAvatar } from "./spirit-avatar.jsx";
import { SpiritMessage } from "./spirit-message.jsx";
import { MethodPrompt } from "./method-prompt.jsx";
import { MethodLibrary } from "./method-library.jsx";
import { localMethod } from "../shared/method-library.js";
import {
  shouldShowMethodIntro,
  prepareReadingTurn,
} from "../shared/methodology-details.js";
import { isUsageQuestion } from "../shared/manual.js";

export function SpiritPanel({
  book,
  chapters,
  chapterId,
  anchor,
  t,
  lang,
  date,
  onUpdate,
  exercises,
  showNote,
  onJump,
  focusSignal = 0,
  helpOnly = false,
  initialMessage = "",
  onHelp,
  onMethodDialog,
  onDiscussionChange,
  onModelChange,
  onReview,
  getReadingLocation,
}) {
  const initial = [...exercises].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];
  const [selected, setSelected] = useState(initial?.id || ""),
    [view, setView] = useState(null),
    [method, setMethod] = useState(initial?.method || "free"),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [catalog, setCatalog] = useState(null),
    [model, setModel] = useState(null),
    [modelBusy, setModelBusy] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [methodHelp, setMethodHelp] = useState(false),
    [watchEpoch, setWatchEpoch] = useState(0),
    [methods, setMethods] = useState([]),
    [override, setOverride] = useState(null),
    [preview, setPreview] = useState(null),
    [includeNotes, setIncludeNotes] = useState(false),
    [methodLibrary, setMethodLibrary] = useState(false),
    [methodStatus, setMethodStatus] = useState(""),
    [previewEpoch, setPreviewEpoch] = useState(0),
    [introPrefs, setIntroPrefs] = useState({}),
    [pickerOpen, setPickerOpen] = useState(false),
    [methodQuery, setMethodQuery] = useState(""),
    [pinPrompt, setPinPrompt] = useState(false),
    [replyLength, setReplyLength] = useState("balanced"),
    [replyBusy, setReplyBusy] = useState(false),
    [favorites, setFavorites] = useState([]),
    [recent, setRecent] = useState(() => {
      try {
        const x = JSON.parse(
          localStorage.getItem("arr-method-recent:v1") || "[]",
        );
        return Array.isArray(x) ? x : [];
      } catch {
        return [];
      }
    });
  const input = useRef(null),
    scroll = useRef(null),
    follow = useRef(true),
    sendRef = useRef(null),
    creatingRef = useRef(null),
    operation = useRef(false),
    mounted = useRef(true),
    selectedRef = useRef(selected),
    pendingRef = useRef(null),
    methodTouched = useRef(false),
    messageRef = useRef(message);
  useEffect(() => {
    onDiscussionChange?.(selected);
  }, [selected]);
  useEffect(() => {
    onModelChange?.(model);
  }, [model]);
  selectedRef.current = selected;
  messageRef.current = message;
  const busy = sending || !!view?.busy;
  const draftKey = "arr-message:" + (selected || "new:" + book.id);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      setMessage(localStorage.getItem(draftKey) || "");
    } catch {
      setMessage("");
    }
    sendRef.current = null;
  }, [draftKey]);
  useEffect(() => {
    if (focusSignal) input.current?.focus();
  }, [focusSignal]);
  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage]);
  async function loadMethods() {
    const x = await rpc({ action: "methods" });
    setMethods(x.items || []);
    setIntroPrefs(x.methodIntro || {});
    setFavorites(x.favorites || []);
    setReplyLength(x.replyLength || "balanced");
    setPreviewEpoch((n) => n + 1);
    return x;
  }
  useEffect(() => {
    loadMethods().catch(() => {});
  }, [methodLibrary]);
  useEffect(() => {
    setPreview(null);
  }, [method]);
  function rememberMethod(id) {
    setRecent((old) => {
      const next = [id, ...old.filter((x) => x !== id)].slice(0, 20);
      try {
        localStorage.setItem("arr-method-recent:v1", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function methodDialog(id, candidate) {
    const m = candidate || methods.find((x) => x.id === id);
    if (!m) {
      setError(t("loading"));
      return;
    }
    onMethodDialog?.({
      method: m,
      bookId: book.id,
      bookTitle: book.title,
      chapterId,
      anchor,
      preference: introPrefs[id],
      override: id === method ? override : null,
      includeNotes: id === method ? includeNotes : false,
      onApply: async (result) => {
        methodTouched.current = true;
        setMethod(result.method.id);
        rememberMethod(result.method.id);
        setOverride(result.override);
        setIncludeNotes(result.includeNotes);
        setIntroPrefs(result.preferences?.methodIntro || {});
        setPickerOpen(false);
        await loadMethods();
      },
    });
  }
  function chooseMethod(id) {
    const m = methods.find((x) => x.id === id);
    if (!m) return;
    if (shouldShowMethodIntro(m, introPrefs[id])) methodDialog(id);
    else {
      methodTouched.current = true;
      setMethod(id);
      rememberMethod(id);
      setOverride(null);
      setIncludeNotes(false);
      setPickerOpen(false);
    }
  }
  useEffect(() => {
    if (helpOnly) return;
    const ac = new AbortController();
    setPreview(null);
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
      .then(setPreview)
      .catch((e) => {
        if (e.name !== "AbortError") setError(localizeError(e.message, t));
      });
    return () => ac.abort();
  }, [
    book.id,
    chapterId,
    anchor,
    method,
    lang,
    override,
    includeNotes,
    previewEpoch,
  ]);
  async function loadModels() {
    try {
      const c = await rpc({ action: "spirit", command: "models" });
      if (mounted.current) setCatalog(c);
    } catch (e) {
      if (mounted.current) setError(localizeError(e.message, t));
    }
  }
  useEffect(() => {
    loadModels();
  }, []);
  useEffect(() => {
    if (!selected) {
      setView(null);
      return;
    }
    let active = true;
    const ac = new AbortController();
    setError("");
    (async () => {
      let v = await rpc(
        { action: "spirit", command: "read", id: selected },
        ac.signal,
      );
      if (!active) return;
      setView(v);
      setModel(v.exercise.model || null);
      if (!operation.current && !methodTouched.current)
        setMethod(v.exercise.method);
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
        if (active) {
          setView(v);
          setModel(v.exercise.model || null);
        }
      }
    })().catch((e) => {
      if (active && e.name !== "AbortError")
        setError(localizeError(e.message, t));
    });
    return () => {
      active = false;
      ac.abort();
    };
  }, [selected, watchEpoch]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop =
        view?.messages.length || view?.liveText
          ? scroll.current.scrollHeight
          : 0;
  }, [view?.messages.length, view?.liveText]);
  async function act(fn) {
    setError("");
    try {
      return await fn();
    } catch (e) {
      if (mounted.current && e.name !== "AbortError")
        setError(localizeError(e.message, t));
    }
  }
  function newDiscussion() {
    if (busy || operation.current) return;
    pendingRef.current = null;
    creatingRef.current = null;
    sendRef.current = null;
    setSelected("");
    setView(null);
    setHistoryOpen(false);
    follow.current = true;
    input.current?.focus();
  }
  function selectHistory(x) {
    if (busy || operation.current) return;
    methodTouched.current = false;
    pendingRef.current = null;
    creatingRef.current = null;
    setSelected(x.id);
    setView(null);
    setMethod(x.method);
    setModel(x.model || null);
    setHistoryOpen(false);
    follow.current = true;
  }
  async function ensureDiscussion() {
    if (selectedRef.current) return selectedRef.current;
    if (pendingRef.current) return pendingRef.current;
    if (!creatingRef.current) creatingRef.current = request();
    const v = await rpc({
      action: "createExercise",
      bookId: book.id,
      method,
      requestId: creatingRef.current,
      item: { model },
    });
    pendingRef.current = v.exercise.id;
    return v.exercise.id;
  }
  async function send(textOverride, followup = false) {
    const turn = prepareReadingTurn({
        message,
        textOverride,
        promptOverride: override,
      }),
      text = turn.text;
    if (!text.trim() || busy || operation.current) return;
    if (
      !helpOnly &&
      !isUsageQuestion(text) &&
      method !== "free" &&
      !introPrefs[method]?.seenRevision
    ) {
      methodDialog(method);
      return;
    }
    operation.current = true;
    setSending(true);
    setError("");
    follow.current = true;
    const outgoingMethod = method,
      oldDraftKey = draftKey;
    if (
      !sendRef.current ||
      sendRef.current.text !== text ||
      sendRef.current.method !== outgoingMethod
    )
      sendRef.current = { requestId: request(), text, method: outgoingMethod };
    try {
      const turnPreview =
        helpOnly || isUsageQuestion(text)
          ? null
          : preview ||
            (await rpc({
              action: "methodPreview",
              bookId: book.id,
              chapterId,
              anchor,
              method,
              language: lang,
              override: override ?? undefined,
              includeNotes,
            }));
      const id = await ensureDiscussion();
      const v = await rpc({
        action: "spirit",
        command: "send",
        id,
        text,
        method: outgoingMethod,
        override: turn.override,
        promptHash: turnPreview?.hash,
        includeNotes,
        uiLanguage: lang,
        help: helpOnly,
        followup,
        readingOffset: getReadingLocation?.()?.textOffset || 0,
        shortcutMac: /Mac/.test(navigator.platform),
        shortcutOverrides: (() => {
          try {
            return JSON.parse(
              localStorage.getItem("arr-reading-shortcuts:v1") || "{}",
            );
          } catch {
            return {};
          }
        })(),
        anchor,
        chapterId,
        language: "auto",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        requestId: sendRef.current.requestId,
      });
      if (!mounted.current) return;
      const remaining = messageRef.current === text ? "" : messageRef.current;
      setMessage(remaining);
      setOverride(null);
      try {
        localStorage.removeItem(oldDraftKey);
        if (remaining) localStorage.setItem("arr-message:" + id, remaining);
        else localStorage.removeItem("arr-message:" + id);
      } catch {}
      selectedRef.current = id;
      setSelected(id);
      setView(v);
      pendingRef.current = null;
      creatingRef.current = null;
      sendRef.current = null;
      await onUpdate();
    } catch (e) {
      if (e.message === "PROMPT_CHANGED")
        loadMethods().catch(() => setPreviewEpoch((n) => n + 1));
      if (mounted.current) setError(localizeError(e.message, t));
    } finally {
      operation.current = false;
      if (mounted.current) setSending(false);
    }
  }
  async function chooseModel(value) {
    if (busy || modelBusy) return;
    const next = value ? JSON.parse(value) : null;
    setModelBusy(true);
    await act(async () => {
      const id = selectedRef.current || pendingRef.current;
      if (id) {
        const v = await rpc({
          action: "spirit",
          command: "selectModel",
          id,
          selection: next,
        });
        if (mounted.current && selectedRef.current === id) setView(v);
      }
      if (mounted.current) setModel(next);
    });
    if (mounted.current) setModelBusy(false);
  }
  const effective = model || catalog?.roomDefault || catalog?.default;
  const group = catalog?.groups.find((g) => g.id === effective?.provider);
  const modelName =
    group?.models.find((m) => m.id === effective?.model)?.name ||
    effective?.model ||
    t("defaultModel");
  const validRefs = (view?.exercise.citations || []).filter((id) =>
    chapters.some((c) => c.id === id),
  );
  const rows = view?.messages || [];
  const choices = [...exercises].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <>
      <div className="arr-chat-tools">
        <div className="row spread">
          <div
            className="arr-method-switch"
            role="group"
            aria-label={t("readingMode")}
          >
            <button
              type="button"
              aria-pressed={method === "free" && !pickerOpen}
              onClick={() => {
                methodTouched.current = true;
                setMethod("free");
                setOverride(null);
                setIncludeNotes(false);
                setPickerOpen(false);
              }}
            >
              {t("free")}
            </button>
            {!helpOnly && (
              <button
                type="button"
                aria-pressed={method !== "free" || pickerOpen}
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen(!pickerOpen)}
              >
                {t("methodologies")} ▾
              </button>
            )}
          </div>
          <div className="row">
            <button
              className="arr-icon-button"
              title={t("help")}
              onClick={() => onHelp?.("methods")}
            >
              ?
            </button>
            <button
              className="arr-icon-button"
              aria-expanded={historyOpen}
              title={t("discussionHistory")}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              ☷
            </button>
            {!helpOnly && onReview && (
              <button
                className="arr-icon-button"
                title={t("readingReview")}
                aria-label={t("readingReview")}
                onClick={onReview}
              >
                ↺
              </button>
            )}
            <button
              className="arr-icon-button"
              disabled={busy}
              title={t("newDiscussion")}
              onClick={newDiscussion}
            >
              ＋
            </button>
          </div>
        </div>
        {!helpOnly && method !== "free" && (
          <div className="arr-method-current">
            <span>
              {t("currentMethod")}：
              <b>
                {localMethod(
                  methods.find((x) => x.id === method)?.name,
                  lang,
                ) || t("unknownMethod")}
              </b>
            </span>
            {introPrefs[method]?.seenRevision &&
              methods.find((x) => x.id === method)?.revision >
                introPrefs[method].seenRevision && (
                <small className="muted">{t("methodUpdated")}</small>
              )}
            <button onClick={() => methodDialog(method)}>
              {t("viewEdit")}
            </button>
            <button onClick={() => setPickerOpen(true)}>
              {t("changeMethod")}
            </button>
            <button
              aria-pressed={pinPrompt}
              onClick={() => {
                if (!pinPrompt)
                  try {
                    localStorage.setItem(
                      "arr-prompt-display:" + method,
                      "full",
                    );
                  } catch {}
                setPinPrompt(!pinPrompt);
              }}
            >
              {t(pinPrompt ? "unpinPrompt" : "pinPrompt")}
            </button>
          </div>
        )}
        {pickerOpen && !helpOnly && (
          <div className="arr-method-picker">
            <input
              value={methodQuery}
              onChange={(e) => setMethodQuery(e.target.value)}
              placeholder={t("methodSearch")}
              aria-label={t("methodSearch")}
            />
            {methods
              .filter(
                (m) =>
                  m.enabled &&
                  m.id !== "free" &&
                  (
                    localMethod(m.name, lang) +
                    " " +
                    localMethod(m.description, lang)
                  )
                    .toLowerCase()
                    .includes(methodQuery.toLowerCase()),
              )
              .sort(
                (a, b) =>
                  Number(favorites.includes(b.id)) -
                    Number(favorites.includes(a.id)) ||
                  (recent.indexOf(a.id) < 0 ? 999 : recent.indexOf(a.id)) -
                    (recent.indexOf(b.id) < 0 ? 999 : recent.indexOf(b.id)),
              )
              .map((m) => (
                <button key={m.id} onClick={() => chooseMethod(m.id)}>
                  <b>
                    {favorites.includes(m.id) ? "★ " : ""}
                    {localMethod(m.name, lang)}
                  </b>
                  <small className="muted">
                    {localMethod(m.description, lang)}
                  </small>
                </button>
              ))}
            <button onClick={() => setMethodLibrary(!methodLibrary)}>
              {t("methodLibrary")}
            </button>
            <p className="muted small">{t("methodSelectHint")}</p>
          </div>
        )}
        {historyOpen && (
          <div className="arr-thread-list">
            <b>{t("discussionHistory")}</b>
            {choices.length ? (
              choices.map((x) => (
                <button
                  type="button"
                  key={x.id}
                  disabled={busy}
                  aria-pressed={x.id === selected}
                  onClick={() => selectHistory(x)}
                >
                  <span>{x.title || x.goal || t(x.method)}</span>
                  <small>{date(x.updatedAt)}</small>
                </button>
              ))
            ) : (
              <p className="muted">{t("noDiscussions")}</p>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="arr-chat-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              setWatchEpoch((x) => x + 1);
              loadModels();
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {methodLibrary && (
        <div className="arr-side-method-library">
          <MethodLibrary
            t={t}
            lang={lang}
            run={act}
            onChoose={(id) =>
              act(async () => {
                const x = await loadMethods();
                methodDialog(
                  id,
                  x.items.find((m) => m.id === id),
                );
                setMethodLibrary(false);
              })
            }
            onSuggest={(prompt) => {
              setMessage(
                (lang === "zh"
                  ? "请为下面的读书方法论建议名称、简介、适用场景和使用步骤，只提供草稿，不改写原提示词：\n"
                  : "Suggest a name, description, scenarios and usage steps for this reading methodology, without rewriting its prompt:\n") +
                  prompt,
              );
              setMethodLibrary(false);
            }}
          />
        </div>
      )}
      <div
        className="arr-chat-scroll"
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        {methodStatus && (
          <p className="muted small" role="status">
            {methodStatus}
          </p>
        )}
        {!rows.length && !view?.liveText && !sending ? (
          <div className="arr-chat-welcome">
            <SpiritAvatar size={92} />
            <h3>{t("spiritWelcome")}</h3>
            <p>{t("spiritWelcomeHint")}</p>
            <div className="arr-starters">
              <button
                type="button"
                onClick={() =>
                  send(
                    localMethod(
                      methods.find((m) => m.id === method)?.starter,
                      lang,
                    ) || t("freeStarter"),
                  )
                }
              >
                {t("readTogether")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage(t("explainStarter"));
                  input.current?.focus();
                }}
              >
                {t("explainPassage")}
              </button>
            </div>
          </div>
        ) : null}
        {rows.map((m) => (
          <article key={m.id} className={"arr-chat-message " + m.role}>
            {m.role === "assistant" && (
              <div className="arr-message-author">
                <SpiritAvatar size={25} />
                <b>{t("spirit")}</b>
              </div>
            )}
            <SpiritMessage
              text={m.text}
              referenceLabel={t("source")}
              references={
                view?.exercise.replyReferences?.[m.id] ||
                (/\[c\d+:\d+-\d+\]/.test(m.text)
                  ? view?.exercise.citationRefs || {}
                  : {})
              }
              citations={m.role === "assistant" ? validRefs : []}
              onJump={onJump}
            />
            <div className="arr-message-meta">
              <span>{date(m.time)}</span>
              {m.role === "assistant" && !helpOnly && (
                <button
                  type="button"
                  onClick={() =>
                    showNote(book.id, "ai", null, m.text, "ai", selected)
                  }
                >
                  {t("saveReply")}
                </button>
              )}
            </div>
            {m.role === "assistant" &&
              m.id === rows.filter((x) => x.role === "assistant").at(-1)?.id &&
              !busy &&
              !helpOnly && (
                <div className="arr-followups">
                  {[
                    ["followupExample", "exampleRequest"],
                    ["followupSimple", "simpleRequest"],
                    ["followupDeep", "deepRequest"],
                  ].map(([label, prompt]) => (
                    <button key={label} onClick={() => send(t(prompt), true)}>
                      {t(label)}
                    </button>
                  ))}
                </div>
              )}
          </article>
        ))}
        {view?.liveText && (
          <article className="arr-chat-message assistant">
            <div className="arr-message-author">
              <SpiritAvatar size={25} />
              <b>{t("spirit")}</b>
            </div>
            <SpiritMessage
              text={view.liveText}
              referenceLabel={t("source")}
              references={view?.exercise.citationRefs || {}}
              citations={validRefs}
              onJump={onJump}
            />
          </article>
        )}
        {busy && !view?.liveText && (
          <p className="arr-chat-status" role="status">
            {t("spiritThinking")}
          </p>
        )}
        {view?.outcome && view.outcome.kind !== "completed" && !busy && (
          <p className="arr-chat-status">
            {view.outcome.error?.message || t("replyStopped")}
          </p>
        )}
      </div>
      <div className="arr-prompt-dock">
        {!helpOnly && method !== "free" && pinPrompt && (
          <MethodPrompt
            book={book}
            chapterId={chapterId}
            anchor={anchor}
            method={method}
            lang={lang}
            t={t}
            override={override}
            setOverride={setOverride}
            preview={preview}
            setPreview={setPreview}
            refreshEpoch={previewEpoch}
            includeNotes={includeNotes}
            setIncludeNotes={setIncludeNotes}
            onHelp={() => onHelp?.("methods")}
            onSave={(p) =>
              act(async () => {
                await rpc({
                  action: "saveMethod",
                  item: {
                    name:
                      p.name + (lang === "zh" ? "（我的版本）" : " (my copy)"),
                    description: p.description,
                    prompt: p.template,
                  },
                  requestId: request(),
                });
                await loadMethods();
                setMethodStatus(t("saved"));
              })
            }
          />
        )}
      </div>
      <div className="arr-chat-compose">
        <div className="arr-reply-length">
          <label>
            {t("replyDepth")}{" "}
            <select
              value={replyLength}
              disabled={replyBusy}
              onChange={async (e) => {
                const length = e.target.value;
                setReplyBusy(true);
                try {
                  await rpc({
                    action: "replyLength",
                    item: { length },
                    requestId: request(),
                  });
                  setReplyLength(length);
                } catch (e) {
                  setError(localizeError(e.message, t));
                } finally {
                  setReplyBusy(false);
                }
              }}
            >
              {["short", "balanced", "deep"].map((v) => (
                <option key={v} value={v}>
                  {t("reply_" + v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {anchor?.quote && (
          <details className="arr-compose-quote">
            <summary>{t("selection")}</summary>
            <blockquote>{anchor.quote}</blockquote>
            <p>{t("contextHint")}</p>
          </details>
        )}
        <div className="arr-compose-box">
          <textarea
            ref={input}
            rows={3}
            value={message}
            placeholder={t("spiritMessagePlaceholder")}
            aria-label={t("message")}
            onChange={(e) => {
              setMessage(e.target.value);
              sendRef.current = null;
              try {
                localStorage.setItem(draftKey, e.target.value);
              } catch {}
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="arr-compose-bottom">
            <span className="arr-key-hint">{t("sendKeys")}</span>
            <div className="arr-compose-actions">
              <label
                className="arr-model-picker"
                title={t("model") + " · " + modelName}
              >
                <span>
                  {modelName}
                  {group ? " · " + group.name : ""}
                </span>
                <span aria-hidden="true">⌄</span>
                <select
                  aria-label={t("model")}
                  value={
                    model
                      ? JSON.stringify({
                          provider: model.provider,
                          model: model.model,
                        })
                      : ""
                  }
                  disabled={busy || modelBusy}
                  onChange={(e) => chooseModel(e.target.value)}
                >
                  <option value="">{t("roomDefaultModel")}</option>
                  {catalog?.groups.map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {g.models.map((m) => (
                        <option
                          key={m.id}
                          value={JSON.stringify({
                            provider: g.id,
                            model: m.id,
                          })}
                        >
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button
                className="arr-icon-button"
                type="button"
                disabled={modelBusy}
                onClick={loadModels}
                title={t("refreshModels")}
                aria-label={t("refreshModels")}
              >
                ↻
              </button>
              {busy ? (
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() =>
                    act(async () =>
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
                  type="button"
                  className="arr-send"
                  disabled={!message.trim() || modelBusy}
                  onClick={() => send()}
                >
                  {t("send")} ↑
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="arr-chat-foot">
          {!anchor && (
            <details>
              <summary>
                {t("scope")} · {t("currentReading")}
              </summary>
              <p>{t("contextHint")}</p>
            </details>
          )}
          {rows.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => send(t("recapRequest"))}
            >
              {t("summarize")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
