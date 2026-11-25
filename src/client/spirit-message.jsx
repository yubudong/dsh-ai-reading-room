import React, { useMemo } from "react";
import { marked } from "marked";
const allowed = new Set([
  "P",
  "BR",
  "STRONG",
  "EM",
  "B",
  "I",
  "DEL",
  "S",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "PRE",
  "CODE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TH",
  "TD",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "A",
]);
function messageHtml(text, citations, references, label) {
  const doc = new DOMParser().parseFromString(
    marked.parse(text, { breaks: true }),
    "text/html",
  );
  for (const el of [...doc.body.querySelectorAll("*")]) {
    if (!allowed.has(el.tagName)) {
      el.remove();
      continue;
    }
    const href = el.getAttribute("href");
    for (const a of [...el.attributes]) el.removeAttribute(a.name);
    if (el.tagName === "A" && /^https?:\/\//i.test(href || "")) {
      el.setAttribute("href", href);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
  const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT),
    nodes = [];
  let node;
  while ((node = walk.nextNode()))
    if (!node.parentElement.closest("pre,code,a")) nodes.push(node);
  for (const n of nodes) {
    if (!/\[c\d+(?::\d+-\d+)?\]/.test(n.textContent)) continue;
    const frag = doc.createDocumentFragment();
    for (const part of n.textContent.split(/(\[c\d+(?::\d+-\d+)?\])/g)) {
      const id = part.slice(1, -1);
      if (
        /^\[c\d+(?::\d+-\d+)?\]$/.test(part) &&
        (references[id] || (!id.includes(":") && citations.includes(id)))
      ) {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "arr-citation";
        b.dataset.reference = id;
        b.textContent = label || part;
        if (references[id]?.quote) b.title = references[id].quote.slice(0, 140);
        frag.append(b);
      } else frag.append(doc.createTextNode(part));
    }
    n.replaceWith(frag);
  }
  return doc.body.innerHTML;
}
export function SpiritMessage({
  text,
  citations = [],
  references = {},
  referenceLabel,
  onJump,
}) {
  const html = useMemo(
    () => messageHtml(text, citations, references, referenceLabel),
    [text, citations, references, referenceLabel],
  );
  return (
    <div
      className="arr-chat-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const button = e.target.closest("button[data-reference]");
        if (!button || !e.currentTarget.contains(button)) return;
        const id = button.dataset.reference;
        if (references[id]) onJump(references[id]);
        else if (!id.includes(":") && citations.includes(id))
          onJump({ chapterId: id, start: 0, end: 1 });
      }}
    />
  );
}
