export const CITATION_PATTERN = /\[(c\d+(?::\d+-\d+)?)\]/g;
export function makeReference(chapterId, text, start = 0, end) {
  const a = Math.max(0, Math.min(text.length, Math.floor(Number(start) || 0))),
    b = Math.max(a, Math.min(text.length, Math.floor(end ?? a + 400)));
  if (b <= a) return null;
  return {
    key: `${chapterId}:${a}-${b}`,
    anchor: {
      chapterId,
      start: a,
      end: b,
      quote: text.slice(a, b),
      prefix: text.slice(Math.max(0, a - 80), a),
      suffix: text.slice(b, b + 80),
    },
  };
}
export function rememberRead(exercise, chapter, text, start, end, selected) {
  const lo = Math.max(0, Math.min(text.length, start || 0)),
    hi = Math.max(lo, Math.min(text.length, end ?? text.length));
  exercise.readRanges ??= {};
  const ranges = [
    ...(exercise.readRanges[chapter] || []),
    [lo, hi],
    ...(selected ? [[selected.start, selected.end]] : []),
  ].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const pair of ranges) {
    const last = merged.at(-1);
    if (last && pair[0] <= last[1]) last[1] = Math.max(last[1], pair[1]);
    else merged.push([...pair]);
  }
  exercise.readRanges[chapter] = merged;
  const ref = makeReference(
    chapter,
    text,
    selected?.start ?? lo,
    selected?.end ?? Math.min(hi, lo + 400),
  );
  if (ref) {
    exercise.citationRefs ??= {};
    exercise.citationRefs[ref.key] = ref.anchor;
    exercise.citationRefs[chapter] = ref.anchor;
  }
  return ref;
}
export function verifyQuoteReference(
  exercise,
  chapter,
  text,
  { start, end, quote },
) {
  const ranges = exercise.readRanges?.[chapter] || [];
  let from = Number.isInteger(start) ? start : null,
    to = Number.isInteger(end) ? end : null;
  if (quote) {
    if (quote.length > 2000 || !quote.trim())
      throw new Error("CITATION_INVALID");
    if (from === null || text.slice(from, from + quote.length) !== quote) {
      const matches = [];
      for (const [a, b] of ranges) {
        let at = text.indexOf(quote, a);
        while (at >= a && at + quote.length <= b) {
          matches.push(at);
          if (matches.length > 1) break;
          at = text.indexOf(quote, at + 1);
        }
        if (matches.length > 1) break;
      }
      if (!matches.length) throw new Error("CITATION_NOT_READ");
      if (matches.length !== 1) throw new Error("CITATION_AMBIGUOUS");
      from = matches[0];
    }
    to = from + quote.length;
  }
  if (
    from === null ||
    to === null ||
    to <= from ||
    to - from > 2000 ||
    !ranges.some(([a, b]) => from >= a && to <= b)
  )
    throw new Error("CITATION_NOT_READ");
  return makeReference(chapter, text, from, to);
}
export function referencesInMessage(text, map = {}) {
  const out = {};
  for (const match of String(text).matchAll(CITATION_PATTERN)) {
    if (map[match[1]]) out[match[1]] = map[match[1]];
  }
  return out;
}
