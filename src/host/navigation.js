import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { decodeHTML } from "entities";
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
});
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
function text(x) {
  if (x == null) return "";
  if (typeof x !== "object") return String(x);
  return Object.entries(x)
    .filter(([k]) => !k.startsWith("@"))
    .map(([, v]) => arr(v).map(text).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
export function epubNavigation(files, manifest, opfPath, chapters, plain) {
  const base = path.posix.dirname(opfPath),
    out = [];
  let count = 0;
  function add(label, href, navPath, depth) {
    if (!label || !href || count >= 10000 || depth > 20) return;
    try {
      const [file, fragment = ""] = href.split("#");
      const target = file
        ? path.posix.normalize(
            path.posix.join(
              path.posix.dirname(navPath),
              decodeURIComponent(file),
            ),
          )
        : navPath;
      const chapter = chapters.find((c) => c.sourceHref === target);
      if (!chapter) return;
      const decoded = decodeURIComponent(fragment);
      let offset = 0;
      if (decoded) {
        const needle =
          'id="' + decoded.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"';
        const at = chapter.html.indexOf(needle);
        if (at >= 0)
          offset = plain(
            chapter.html.slice(0, chapter.html.lastIndexOf("<", at)),
          ).length;
      }
      out.push({
        id: "nav-" + count++,
        title: decodeHTML(String(label)).replace(/\s+/g, " ").trim(),
        chapterId: chapter.id,
        depth,
        fragment: decoded,
        textOffset: offset,
      });
    } catch {}
  }
  const nav = manifest.find((i) =>
    String(i["@properties"] || "")
      .split(/\s+/)
      .includes("nav"),
  );
  if (nav) {
    try {
      const file = path.posix.normalize(
          path.posix.join(base, decodeURIComponent(nav["@href"])),
        ),
        d = xml.parse(new TextDecoder().decode(files[file]));
      function find(node) {
        if (!node || typeof node !== "object") return null;
        for (const n of arr(node.nav))
          if (
            String(n["@type"] || n["@epub:type"] || "")
              .split(/\s+/)
              .includes("toc") ||
            n.ol
          )
            return n;
        for (const [k, v] of Object.entries(node))
          if (!k.startsWith("@"))
            for (const child of arr(v)) {
              const n = find(child);
              if (n) return n;
            }
        return null;
      }
      const toc = find(d);
      function walk(ol, depth) {
        for (const list of arr(ol))
          for (const li of arr(list?.li)) {
            const a = arr(li?.a)[0];
            if (a) add(text(a), a["@href"], file, depth);
            if (li?.ol) walk(li.ol, depth + 1);
          }
      }
      if (toc) walk(toc.ol, 0);
    } catch {}
  }
  if (!out.length) {
    const ncx = manifest.find(
      (i) => i["@media-type"] === "application/x-dtbncx+xml",
    );
    if (ncx)
      try {
        const file = path.posix.normalize(
            path.posix.join(base, decodeURIComponent(ncx["@href"])),
          ),
          d = xml.parse(new TextDecoder().decode(files[file]));
        function walk(points, depth) {
          if (depth > 20) return;
          for (const n of arr(points)) {
            add(
              text(n.navLabel?.text || n.navLabel),
              arr(n.content)[0]?.["@src"],
              file,
              depth,
            );
            walk(n.navPoint, depth + 1);
          }
        }
        walk(d.ncx?.navMap?.navPoint, 0);
      } catch {}
  }
  for (const c of chapters) {
    const node = out.find((n) => n.chapterId === c.id);
    if (node) c.title = node.title;
  }
  return out.length
    ? out
    : chapters.map((c, i) => ({
        id: "nav-" + i,
        title: c.title || String(i + 1),
        chapterId: c.id,
        depth: 0,
        fragment: "",
        textOffset: 0,
      }));
}
