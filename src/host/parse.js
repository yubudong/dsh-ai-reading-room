import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import sanitize from "sanitize-html";
import { decodeHTML } from "entities";
import { marked } from "marked";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { epubNavigation } from "./navigation.js";

export const MAX_FILE = 64 * 1024 * 1024;
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  processEntities: true,
});
const array = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const value = (x) =>
  typeof x === "object" ? String(x?.["#text"] || "") : String(x || "");
export const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function plain(html) {
  return decodeHTML(
    sanitize(html, {
      allowedTags: [],
      allowedAttributes: {},
      textFilter: (t) => t,
    }),
  ).replace(/\r/g, "");
}
export function clean(html, imageResolver) {
  return sanitize(html, {
    allowedTags: [
      "p",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "pre",
      "code",
      "br",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "sup",
      "sub",
      "a",
      "img",
      "figure",
      "figcaption",
      "dl",
      "dt",
      "dd",
    ],
    allowedAttributes: {
      a: ["href", "id", "title"],
      "*": ["id"],
      img: ["src", "alt", "title"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    transformTags: {
      img: (_tag, a) => ({
        tagName: "img",
        attribs: { src: imageResolver?.(a.src) || "", alt: a.alt || "" },
      }),
      a: (_tag, a) => ({
        tagName: "a",
        attribs: { ...a, href: a.href?.startsWith("#") ? a.href : "" },
      }),
    },
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "noscript",
      "iframe",
      "object",
      "svg",
      "math",
    ],
  });
}
function paragraphHtml(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => "<p>" + escape(p).replace(/\n/g, "<br>") + "</p>")
    .join("\n");
}
function chunks(text, title, markdown = false) {
  const lines = text.split("\n"),
    parts = [];
  let current = [],
    name = title,
    size = 0;
  function push() {
    if (current.length) {
      const body = current.join("\n");
      parts.push({
        title: name,
        html: clean(markdown ? marked.parse(body) : paragraphHtml(body)),
      });
    }
    current = [];
    size = 0;
  }
  for (const line of lines) {
    const heading = markdown
      ? line.match(/^#{1,3}\s+(.+)/)
      : line.match(
          /^\s*((?:第[零〇一二三四五六七八九十百千万\d]+[章节卷部回]|Chapter\s+\d+).{0,90})\s*$/i,
        );
    if ((heading && current.length && size > 100) || size > 24000) {
      push();
      name = heading?.[1] || title + " " + (parts.length + 1);
    }
    if (heading && size === 0) name = heading[1];
    current.push(line);
    size += line.length;
  }
  push();
  return parts;
}
// Check ZIP central-directory sizes BEFORE allocating decompressed content.
export function checkedZip(bytes) {
  const b = Buffer.from(bytes);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (b.readUInt32LE(i) === 0x06054b50) {
      e = i;
      break;
    }
  if (e < 0) throw new Error("BAD_ZIP");
  const count = b.readUInt16LE(e + 10),
    offset = b.readUInt32LE(e + 16);
  if (count > 12000 || count === 65535) throw new Error("ZIP_LIMIT");
  let p = offset,
    total = 0;
  const names = new Set();
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50)
      throw new Error("BAD_ZIP");
    const size = b.readUInt32LE(p + 24),
      nl = b.readUInt16LE(p + 28),
      xl = b.readUInt16LE(p + 30),
      cl = b.readUInt16LE(p + 32);
    const name = b.subarray(p + 46, p + 46 + nl).toString("utf8");
    if (
      size > 64 * 1024 * 1024 ||
      (total += size) > 192 * 1024 * 1024 ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").includes("..") ||
      names.has(name)
    )
      throw new Error("ZIP_LIMIT");
    names.add(name);
    p += 46 + nl + xl + cl;
  }
  return unzipSync(bytes);
}
function epub(bytes) {
  const files = checkedZip(bytes),
    read = (name) => {
      if (!files[name]) throw new Error("EPUB_MISSING_RESOURCE");
      return new TextDecoder().decode(files[name]);
    };
  if (files["META-INF/encryption.xml"]) throw new Error("EPUB_ENCRYPTED");
  const container = xml.parse(read("META-INF/container.xml"));
  const opfPath = array(container.container?.rootfiles?.rootfile)[0]?.[
    "@full-path"
  ];
  if (!opfPath) throw new Error("EPUB_CONTAINER");
  const pkg = xml.parse(read(opfPath)).package,
    root = path.posix.dirname(opfPath);
  const resolve = (href) =>
    path.posix.normalize(
      path.posix.join(root, decodeURIComponent(String(href).split("#")[0])),
    );
  const items = array(pkg.manifest?.item),
    byId = new Map(items.map((i) => [i["@id"], i]));
  const images = new Map();
  for (const item of items) {
    const type = item["@media-type"];
    if (/^image\/(png|jpeg|gif|webp)$/.test(type)) {
      const name = resolve(item["@href"]),
        data = files[name];
      if (data && data.length < 4 * 1024 * 1024)
        images.set(
          name,
          "data:" + type + ";base64," + Buffer.from(data).toString("base64"),
        );
    }
  }
  const coverItem =
    items.find((i) => String(i["@properties"]).includes("cover-image")) ||
    byId.get(
      array(pkg.metadata?.meta).find((m) => m["@name"] === "cover")?.[
        "@content"
      ],
    );
  const chapters = [];
  for (const ref of array(pkg.spine?.itemref)) {
    const item = byId.get(ref["@idref"]);
    if (
      !item ||
      !["application/xhtml+xml", "text/html"].includes(item["@media-type"])
    )
      continue;
    const name = resolve(item["@href"]);
    const raw = read(name);
    const title = plain(
      raw.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] ||
        raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
        String(chapters.length + 1),
    ).trim();
    const body = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || raw;
    chapters.push({
      title,
      id: "c" + chapters.length,
      sourceHref: name,
      html: clean(body, (src) => {
        try {
          return (
            images.get(
              path.posix.normalize(
                path.posix.join(
                  path.posix.dirname(name),
                  decodeURIComponent(src || ""),
                ),
              ),
            ) || ""
          );
        } catch {
          return "";
        }
      }),
    });
  }
  if (!chapters.length) throw new Error("EPUB_NO_CHAPTERS");
  return {
    title: value(pkg.metadata?.title),
    author: array(pkg.metadata?.creator).map(value).join(", "),
    language: value(pkg.metadata?.language),
    cover: coverItem ? images.get(resolve(coverItem["@href"])) || "" : "",
    toc: epubNavigation(files, items, opfPath, chapters, plain),
    navigationVersion: 2,
    chapters,
  };
}
export async function parseBook(bytes, name, encoding = "utf-8") {
  if (!bytes.length || bytes.length > MAX_FILE)
    throw new Error("FILE_SIZE_LIMIT");
  const format = path.extname(name).toLowerCase().slice(1);
  let result;
  const fallback = path.basename(name, path.extname(name));
  if (format === "epub") result = epub(bytes);
  else if (format === "pdf") {
    if (Buffer.from(bytes.subarray(0, 1024)).indexOf("%PDF-") < 0)
      throw new Error("BAD_PDF");
    if (!globalThis.DOMMatrix) {
      const { default: DOMMatrix } = await import("@thednp/dommatrix");
      globalThis.DOMMatrix = DOMMatrix;
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfRoot = path.dirname(
      createRequire(import.meta.url).resolve("pdfjs-dist/package.json"),
    );
    const task = pdfjs.getDocument({
      cMapUrl: path.join(pdfRoot, "cmaps") + path.sep,
      cMapPacked: true,
      standardFontDataUrl: path.join(pdfRoot, "standard_fonts") + path.sep,
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
    });
    try {
      const doc = await task.promise;
      if (doc.numPages > 2500) throw new Error("PDF_PAGE_LIMIT");
      const meta = await doc.getMetadata().catch(() => null);
      const labels = await doc.getPageLabels().catch(() => null);
      const chapters = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i),
          text = await page.getTextContent();
        const lines = [];
        let line = "";
        for (const item of text.items) {
          if (!("str" in item)) continue;
          line += item.str;
          if (item.hasEOL) {
            lines.push(line);
            line = "";
          } else line += " ";
        }
        if (line) lines.push(line);
        chapters.push({
          title: String(i),
          pageLabel: labels?.[i - 1] || "",
          html: paragraphHtml(lines.join("\n")),
        });
        page.cleanup();
      }
      result = {
        title: meta?.info?.Title || fallback,
        author: meta?.info?.Author || "",
        chapters,
      };
    } finally {
      await task.destroy();
    }
  } else if (["txt", "md", "markdown"].includes(format)) {
    let text;
    try {
      text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      if (encoding !== "utf-8") throw new Error("TEXT_ENCODING");
      text = new TextDecoder("gb18030").decode(bytes);
    }
    result = {
      title: fallback,
      author: "",
      chapters: chunks(text, fallback, format !== "txt"),
    };
  } else throw new Error("UNSUPPORTED_FORMAT");
  const chapters = result.chapters.map((c, i) => ({
    ...c,
    id: "c" + i,
    text: plain(c.html),
    index: i,
  }));
  return {
    ...result,
    title: result.title || fallback,
    format: format === "markdown" ? "md" : format,
    chapters,
    hash: hash(bytes),
    hasText: chapters.some((c) => c.text.trim().length > 10),
    parserVersion: 1,
  };
}
