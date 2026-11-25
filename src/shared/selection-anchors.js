const ignored = /[\s\u200b\ufeff\u00ad]/u;
function compact(value) {
  const indexes = [];
  let text = "";
  for (let i = 0; i < value.length; i++)
    if (!ignored.test(value[i])) {
      text += value[i];
      indexes.push(i);
    }
  return { text, indexes };
}
function compactLength(value) {
  let n = 0;
  for (const c of value) if (!ignored.test(c)) n += c.length;
  return n;
}
export function selectionAnchor({ chapterId, canonical, domText, start, end }) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > domText.length
  )
    return null;
  const selected = domText.slice(start, end);
  if (!selected.trim() || selected.length > 20000) return null;
  if (domText === canonical) return { chapterId, start, end, quote: selected };
  const source = compact(canonical),
    dom = compact(domText),
    wanted = compact(selected).text;
  if (!wanted) return null;
  let at;
  if (source.text === dom.text) {
    at = compactLength(domText.slice(0, start));
  } else {
    const prefix = compact(
        domText.slice(Math.max(0, start - 120), start),
      ).text.slice(-50),
      suffix = compact(domText.slice(end, end + 120)).text.slice(0, 50);
    const candidates = [];
    let p = source.text.indexOf(wanted),
      limit = 0;
    while (p >= 0 && limit++ < 500) {
      let score = 0;
      if (
        prefix &&
        source.text.slice(Math.max(0, p - prefix.length), p) === prefix
      )
        score += prefix.length;
      if (
        suffix &&
        source.text.slice(
          p + wanted.length,
          p + wanted.length + suffix.length,
        ) === suffix
      )
        score += suffix.length;
      candidates.push({ at: p, score });
      p = source.text.indexOf(wanted, p + 1);
    }
    if (!candidates.length || limit >= 500) return null;
    candidates.sort((a, b) => b.score - a.score);
    if (
      candidates.length > 1 &&
      (candidates[0].score < 8 || candidates[0].score === candidates[1].score)
    )
      return null;
    at = candidates[0].at;
  }
  const last = at + wanted.length - 1;
  if (
    source.text.slice(at, at + wanted.length) !== wanted ||
    source.indexes[at] === undefined ||
    source.indexes[last] === undefined
  )
    return null;
  const from = source.indexes[at],
    to = source.indexes[last] + 1,
    quote = canonical.slice(from, to);
  if (quote.length > 20000) return null;
  return { chapterId, start: from, end: to, quote };
}
export function annotationPaintKey(records, chapterId) {
  return JSON.stringify(
    records
      .filter((r) => !r.deletedAt && r.anchor?.chapterId === chapterId)
      .map((r) => [
        r.id,
        r.anchor.start,
        r.anchor.end,
        r.anchor.quote,
        r.annotation?.style || "underline",
        r.annotation?.color || "yellow",
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}
export function canonicalOffset(domText, canonical, offset) {
  if (domText === canonical) return offset;
  const a = compact(domText),
    b = compact(canonical);
  if (a.text !== b.text) return null;
  return (
    b.indexes[
      Math.min(b.indexes.length - 1, compactLength(domText.slice(0, offset)))
    ] ?? 0
  );
}
