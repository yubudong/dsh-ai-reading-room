import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionAnchor,
  annotationPaintKey,
  canonicalOffset,
} from "../src/shared/selection-anchors.js";
test("an ordinary text selection keeps exact canonical offsets", () => {
  const text = "第一段。这里是需要标注的文字。";
  const start = text.indexOf("需要"),
    end = text.indexOf("文字") + 2;
  assert.deepEqual(
    selectionAnchor({
      chapterId: "c0",
      canonical: text,
      domText: text,
      start,
      end,
    }),
    { chapterId: "c0", start, end, quote: text.slice(start, end) },
  );
});
test("collapsed whitespace across paragraphs maps to original text without changing saved offsets", () => {
  const canonical = "\n  第一段。\n\n  第二段文字。\n",
    domText = "第一段。 第二段文字。";
  const start = domText.indexOf("段。"),
    end = domText.indexOf("文字") + 2;
  const a = selectionAnchor({
    chapterId: "c0",
    canonical,
    domText,
    start,
    end,
  });
  assert.equal(a.start, canonical.indexOf("段。"));
  assert.equal(a.end, canonical.indexOf("文字") + 2);
  assert.equal(a.quote, canonical.slice(a.start, a.end));
});
test("nonbreaking and invisible spaces do not cause repeated phrases to map to the wrong occurrence", () => {
  const canonical = "重复文字\u00a0第一处。\n  重复文字\u200b第二处。",
    domText = "重复文字 第一处。 重复文字第二处。";
  const start = domText.lastIndexOf("重复文字");
  const a = selectionAnchor({
    chapterId: "c0",
    canonical,
    domText,
    start,
    end: domText.length,
  });
  assert.equal(a.start, canonical.lastIndexOf("重复文字"));
  assert.equal(a.end, canonical.length);
  assert.equal(canonicalOffset(domText, canonical, start), a.start);
});
test("a unique verified passage can be selected after unrelated rendering differences", () => {
  const canonical = "未渲染的说明。唯一目标句。后面的文字。",
    domText = "唯一目标句。后面的文字。";
  const a = selectionAnchor({
    chapterId: "c0",
    canonical,
    domText,
    start: 0,
    end: 6,
  });
  assert.equal(a.start, canonical.indexOf("唯一目标句"));
  assert.equal(a.quote, "唯一目标句。");
});
test("ambiguous or empty selections are rejected instead of creating a misplaced annotation", () => {
  assert.equal(
    selectionAnchor({
      chapterId: "c0",
      canonical: "甲目标甲。乙目标乙。",
      domText: "新增目标",
      start: 2,
      end: 4,
    }),
    null,
  );
  assert.equal(
    selectionAnchor({
      chapterId: "c0",
      canonical: "  ",
      domText: "  ",
      start: 0,
      end: 2,
    }),
    null,
  );
});
test("progress, message refresh and note metadata do not invalidate annotation painting", () => {
  const record = {
    id: "r",
    kind: "highlight",
    body: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    revision: 1,
    anchor: { chapterId: "c0", start: 0, end: 2, quote: "文字" },
    annotation: { style: "highlight", color: "yellow" },
  };
  const key = annotationPaintKey([record], "c0");
  assert.equal(
    annotationPaintKey(
      [
        {
          ...record,
          body: "Later reflection",
          updatedAt: "2026-01-02",
          revision: 2,
          questionState: "understood",
        },
      ],
      "c0",
    ),
    key,
  );
  assert.equal(
    annotationPaintKey(
      [
        record,
        {
          ...record,
          id: "other",
          anchor: { ...record.anchor, chapterId: "c1" },
        },
      ],
      "c0",
    ),
    key,
  );
  assert.notEqual(
    annotationPaintKey(
      [{ ...record, annotation: { style: "underline", color: "yellow" } }],
      "c0",
    ),
    key,
  );
  assert.notEqual(
    annotationPaintKey([{ ...record, deletedAt: "2026-01-03" }], "c0"),
    key,
  );
});
