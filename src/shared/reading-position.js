export function textLocation(chapterId, text, offset, delta = 0) {
  const at = Math.max(
    0,
    Math.min(Math.max(0, text.length - 1), Math.floor(Number(offset) || 0)),
  );
  return {
    mode: "text",
    chapterId,
    textOffset: at,
    quote: text.slice(at, at + 100),
    prefix: text.slice(Math.max(0, at - 40), at),
    suffix: text.slice(at + 100, at + 140),
    delta: Math.max(-200, Math.min(200, Number(delta) || 0)),
  };
}
export function resolveTextLocation(text, location) {
  if (!location || location.mode !== "text") return null;
  const at = Math.max(
    0,
    Math.min(text.length, Math.floor(location.textOffset || 0)),
  );
  if (
    location.quote &&
    text.slice(at, at + location.quote.length) === location.quote &&
    (!location.prefix ||
      text.slice(Math.max(0, at - location.prefix.length), at) ===
        location.prefix) &&
    (!location.suffix ||
      text.slice(
        at + location.quote.length,
        at + location.quote.length + location.suffix.length,
      ) === location.suffix)
  )
    return at;
  if (!location.quote) return Math.min(at, Math.max(0, text.length - 1));
  let best = null,
    score = -Infinity,
    pos = text.indexOf(location.quote),
    count = 0;
  while (pos >= 0 && count++ < 500) {
    let s = -Math.abs(pos - at) / Math.max(1, text.length);
    if (
      location.prefix &&
      text.slice(Math.max(0, pos - location.prefix.length), pos) ===
        location.prefix
    )
      s += 4;
    if (
      location.suffix &&
      text.slice(
        pos + location.quote.length,
        pos + location.quote.length + location.suffix.length,
      ) === location.suffix
    )
      s += 4;
    if (s > score) {
      best = pos;
      score = s;
    }
    pos = text.indexOf(location.quote, pos + 1);
  }
  return best;
}
export function pdfLocation(
  chapterId,
  scrollTop,
  scrollHeight,
  clientHeight,
  scrollLeft = 0,
  scrollWidth = 0,
  clientWidth = 0,
) {
  return {
    mode: "pdf",
    chapterId,
    fraction: Math.max(
      0,
      Math.min(1, scrollTop / Math.max(1, scrollHeight - clientHeight)),
    ),
    xFraction: Math.max(
      0,
      Math.min(1, scrollLeft / Math.max(1, scrollWidth - clientWidth)),
    ),
  };
}
export function locationScroll(location, scrollHeight, clientHeight) {
  return (
    Math.max(0, scrollHeight - clientHeight) *
    Math.max(0, Math.min(1, location?.fraction || 0))
  );
}
