import { annotationAppearance } from "./annotations.js";
export function recordDay(value, zone = "UTC") {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function filterLearningRecords(items, f = {}, books = []) {
  const titles = new Map(books.map((b) => [b.id, b.title]));
  const q = String(f.query || "")
    .trim()
    .toLocaleLowerCase();
  return items
    .filter((r) => {
      if (!!r.deletedAt !== !!f.trash) return false;
      if (f.bookId && r.bookId !== f.bookId) return false;
      if (f.kind && r.kind !== f.kind) return false;
      if (
        f.onlyUnwritten &&
        (!r.anchor ||
          r.body.trim() ||
          r.anchor.pageOnly ||
          r.anchor.end <= r.anchor.start ||
          annotationAppearance(r).style === "none")
      )
        return false;
      if (
        f.onlyOpenQuestions &&
        (r.kind !== "question" || r.questionState === "understood")
      )
        return false;
      const a = annotationAppearance(r);
      if (
        f.color &&
        (!r.anchor || r.anchor.pageOnly || r.anchor.end <= r.anchor.start)
      )
        return false;
      if (f.color === "underline" && a.style !== "underline") return false;
      if (
        f.color &&
        f.color !== "underline" &&
        (a.style !== "highlight" || a.color !== f.color)
      )
        return false;
      const day = recordDay(r.createdAt, f.zone);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      return (
        !q ||
        (
          r.body +
          " " +
          (r.anchor?.quote || "") +
          " " +
          (titles.get(r.bookId) || "")
        )
          .toLocaleLowerCase()
          .includes(q)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function exportLearningRecords(items, books, language = "zh") {
  const map = new Map(books.map((b) => [b.id, b]));
  const zh = language !== "en";
  let out = "# " + (zh ? "我的阅读记录" : "My reading records") + "\n\n";
  for (const r of items) {
    const book = map.get(r.bookId);
    out +=
      "## " +
      (book?.title || r.bookId) +
      " · " +
      r.kind +
      "\n\n" +
      r.createdAt +
      "\n\n";
    if (r.anchor) {
      out +=
        "[" +
        r.anchor.chapterId +
        ":" +
        r.anchor.start +
        "-" +
        r.anchor.end +
        "]\n\n";
      if (r.anchor.quote)
        out += "> " + r.anchor.quote.replace(/\n/g, "\n> ") + "\n\n";
      const a = annotationAppearance(r);
      if (
        a.style !== "none" &&
        !r.anchor.pageOnly &&
        r.anchor.end > r.anchor.start
      )
        out +=
          (zh ? "标注" : "Annotation") +
          ": " +
          a.style +
          " / " +
          a.color +
          "\n\n";
    }
    if (r.kind === "question")
      out +=
        (zh ? "疑问状态" : "Question state") +
        ": " +
        (r.questionState || "open") +
        "\n\n";
    out +=
      r.body +
      "\n\n" +
      (zh ? "来源" : "Origin") +
      ": " +
      r.origin +
      "\n\n---\n\n";
  }
  return out;
}
