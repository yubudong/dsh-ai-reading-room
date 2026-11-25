import React, { useState, useEffect } from "react";
import { rpc, request, download } from "./api.js";
import { filterLearningRecords } from "../shared/learning-records.js";
import { ANNOTATION_COLORS } from "../shared/annotations.js";
export function LearningTraces({
  items,
  data,
  query,
  setQuery,
  t,
  date,
  open,
  openAt,
  run,
  refresh,
  setModal,
  RecordCard,
  lang = "zh",
}) {
  const [filters, setFilters] = useState({
      bookId: "",
      kind: "",
      color: "",
      from: "",
      to: "",
      onlyUnwritten: false,
      onlyOpenQuestions: false,
      trash: false,
    }),
    [selected, setSelected] = useState(new Set()),
    [page, setPage] = useState(0),
    [status, setStatus] = useState("");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    rows = filterLearningRecords(
      items,
      { ...filters, query, zone },
      data.books,
    ),
    visible = rows.slice(page * 40, page * 40 + 40),
    selectedRows = rows.filter((r) => selected.has(r.id));
  useEffect(() => {
    setSelected(new Set());
    setPage(0);
    setStatus("");
  }, [query, filters]);
  useEffect(
    () =>
      setPage((p) => Math.max(0, Math.min(p, Math.ceil(rows.length / 40) - 1))),
    [rows.length],
  );
  function filter(key, value) {
    setFilters((old) => ({
      ...old,
      [key]: value,
      ...(key === "kind" && value !== "question"
        ? { onlyOpenQuestions: false }
        : {}),
      ...(key === "onlyOpenQuestions" && value ? { kind: "question" } : {}),
    }));
  }
  return (
    <div className="scroll page arr-learning-traces">
      <h2>{t("traces")}</h2>
      <div className="arr-trace-filters">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("noteFilter")}
          aria-label={t("noteFilter")}
        />
        <select
          aria-label={t("filterBook")}
          value={filters.bookId}
          onChange={(e) => filter("bookId", e.target.value)}
        >
          <option value="">{t("allBooks")}</option>
          {data.books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filterKind")}
          value={filters.kind}
          onChange={(e) => filter("kind", e.target.value)}
        >
          <option value="">{t("allKinds")}</option>
          {["highlight", "reflection", "question", "note", "ai", "review"].map(
            (k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ),
          )}
        </select>
        <select
          aria-label={t("filterColor")}
          value={filters.color}
          onChange={(e) => filter("color", e.target.value)}
        >
          <option value="">{t("allColors")}</option>
          {ANNOTATION_COLORS.map((c) => (
            <option key={c} value={c}>
              {data.preferences?.annotationLabels?.[c] || t("ann_" + c)}
            </option>
          ))}
          <option value="underline">{t("underline")}</option>
        </select>
        <label>
          {t("dateFrom")}
          <input
            type="date"
            value={filters.from}
            onChange={(e) => filter("from", e.target.value)}
          />
        </label>
        <label>
          {t("dateTo")}
          <input
            type="date"
            value={filters.to}
            onChange={(e) => filter("to", e.target.value)}
          />
        </label>
      </div>
      <div className="row arr-trace-flags">
        <label className="arr-check">
          <input
            type="checkbox"
            checked={filters.onlyUnwritten}
            onChange={(e) => filter("onlyUnwritten", e.target.checked)}
          />
          {t("onlyUnwritten")}
        </label>
        <label className="arr-check">
          <input
            type="checkbox"
            checked={filters.onlyOpenQuestions}
            onChange={(e) => filter("onlyOpenQuestions", e.target.checked)}
          />
          {t("onlyOpenQuestions")}
        </label>
        <button
          aria-selected={filters.trash}
          onClick={() => filter("trash", !filters.trash)}
        >
          {t("trash")}
        </button>
        <button
          onClick={() => {
            setFilters({
              bookId: "",
              kind: "",
              color: "",
              from: "",
              to: "",
              onlyUnwritten: false,
              onlyOpenQuestions: false,
              trash: false,
            });
            setQuery("");
          }}
        >
          {t("clearFilters")}
        </button>
      </div>
      <div className="row arr-trace-batch">
        <span>
          {rows.length} {t("records")} · {t("selectedCount")}{" "}
          {selectedRows.length}
        </span>
        <button
          onClick={() => {
            if (rows.length > 1000) {
              setStatus(t("narrowSelection"));
              return;
            }
            setSelected(
              selectedRows.length === rows.length
                ? new Set()
                : new Set(rows.map((r) => r.id)),
            );
          }}
        >
          {t("selectFiltered")}
        </button>
        <button
          disabled={!selectedRows.length || filters.trash}
          onClick={() =>
            run(async () => {
              const x = await rpc({
                action: "exportRecords",
                item: { ids: selectedRows.map((r) => r.id) },
                language: lang,
              });
              download(x.text, x.name, "text/markdown;charset=utf-8");
            })
          }
        >
          {t("exportSelected")}
        </button>
      </div>
      {status && <p role="status">{status}</p>}
      {filters.from && filters.to && filters.from > filters.to && (
        <p className="error">{t("dateRangeInvalid")}</p>
      )}
      {!rows.length && <p className="empty">{t("noFilteredRecords")}</p>}
      {visible.map((r) => (
        <div className="arr-trace-entry" key={r.id}>
          <div className="row spread">
            <button className="link" onClick={() => open(r.bookId)}>
              {data.books.find((b) => b.id === r.bookId)?.title || r.bookId}
            </button>
            <label className="arr-check">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                aria-label={t("selectRecord")}
                onChange={(e) =>
                  setSelected((old) => {
                    const next = new Set(old);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    return next;
                  })
                }
              />
              {t("selectRecord")}
            </label>
          </div>
          <RecordCard
            r={r}
            labels={data.preferences?.annotationLabels}
            t={t}
            date={date}
            onSource={(anchor) => (openAt || open)(r.bookId, anchor)}
            onEdit={() =>
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
            onQuestionState={(state) =>
              run(async () => {
                await rpc({
                  action: "questionState",
                  id: r.id,
                  revision: r.revision,
                  item: { state },
                  requestId: request(),
                });
                await refresh();
              })
            }
            onTrash={() =>
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
      {rows.length > 40 && (
        <div className="row">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {t("previousPage")}
          </button>
          <span>
            {page + 1}/{Math.ceil(rows.length / 40)}
          </span>
          <button
            disabled={(page + 1) * 40 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("nextPage")}
          </button>
        </div>
      )}
    </div>
  );
}
