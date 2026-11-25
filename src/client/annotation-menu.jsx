import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import {
  ANNOTATION_COLORS,
  ANNOTATION_PALETTE,
  menuPosition,
  annotationAppearance,
} from "../shared/annotations.js";
export function AnnotationSwatches({
  value,
  onChange,
  t,
  disabled = false,
  labels = {},
}) {
  return (
    <div
      className="arr-annotation-colors"
      role="group"
      aria-label={t("annotationStyle")}
    >
      {ANNOTATION_COLORS.map((color) => (
        <button
          type="button"
          key={color}
          className="arr-color-dot"
          style={{ "--arr-dot": ANNOTATION_PALETTE[color] }}
          aria-label={labels[color] || t("ann_" + color)}
          title={t("ann_" + color)}
          aria-pressed={value?.style === "highlight" && value.color === color}
          disabled={disabled}
          onClick={() => onChange({ style: "highlight", color })}
        >
          <span />
        </button>
      ))}
      <button
        type="button"
        className="arr-underline-choice"
        title={t("underline")}
        aria-label={t("underline")}
        aria-pressed={value?.style === "underline"}
        disabled={disabled}
        onClick={() =>
          onChange({ style: "underline", color: value?.color || "yellow" })
        }
      >
        U
      </button>
    </div>
  );
}
export function AnnotationBadge({ value, t, labels = {} }) {
  if (!value || value.style === "none") return null;
  return (
    <span
      className={"arr-annotation-badge " + value.style}
      style={{ "--arr-dot": ANNOTATION_PALETTE[value.color] }}
      title={t(
        value.style === "underline" ? "underline" : "ann_" + value.color,
      )}
      aria-label={t(
        value.style === "underline" ? "underline" : "ann_" + value.color,
      )}
    >
      {value.style === "underline" ? "U" : ""}
    </span>
  );
}
export function AnnotationMenu({
  menu,
  bounds,
  record,
  t,
  busy,
  onStyle,
  onNote,
  onRemove,
  onAsk,
  onCopy,
  onTranslate,
  onSearch,
  onClose,
  history = {},
  onUndo,
  onRedo,
  labels = {},
}) {
  const ref = useRef(null),
    prior = useRef(document.activeElement),
    [position, setPosition] = useState({ left: menu.x, top: menu.y }),
    context = true;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPosition(
      menuPosition(menu.x, menu.y, el.offsetWidth, el.offsetHeight, bounds),
    );
    if (context) el.querySelector("button")?.focus({ preventScroll: true });
  }, [menu.key, bounds.width, bounds.height, context]);
  useEffect(() => {
    const doc = ref.current.ownerDocument;
    function outside(e) {
      if (!ref.current?.contains(e.target)) onClose();
    }
    function key(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        prior.current?.focus({ preventScroll: true });
      }
      if (context && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        const buttons = [
          ...ref.current.querySelectorAll("button:not(:disabled)"),
        ];
        const i = buttons.indexOf(doc.activeElement);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                buttons.length;
        e.preventDefault();
        buttons[next]?.focus();
      }
    }
    doc.addEventListener("pointerdown", outside, true);
    doc.addEventListener("keydown", key);
    return () => {
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", key);
    };
  }, [menu.key, context]);
  return (
    <div
      ref={ref}
      className={"arr-annotation-menu is-context"}
      style={position}
      role="menu"
      aria-label={t("annotationActions")}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.pointerType === "mouse") e.preventDefault();
      }}
    >
      <AnnotationSwatches
        labels={labels}
        value={record ? annotationAppearance(record) : null}
        onChange={onStyle}
        t={t}
        disabled={busy}
      />

      <div className="arr-annotation-items">
        <button role="menuitem" disabled={busy} onClick={onNote}>
          ▤ <span>{t(record?.body?.trim() ? "editNote" : "addNote")}</span>
        </button>
        <button role="menuitem" disabled={busy || !record} onClick={onRemove}>
          ⊖{" "}
          <span>
            {t(
              record && (record.body?.trim() || record.kind !== "highlight")
                ? "removeMarkKeepNote"
                : "removeAnnotation",
            )}
          </span>
        </button>
        <hr />
        <button
          role="menuitem"
          disabled={busy || !history.canUndo}
          onClick={onUndo}
        >
          ↶ <span>{t("undoAnnotation")}</span>
        </button>
        <button
          role="menuitem"
          disabled={busy || !history.canRedo}
          onClick={onRedo}
        >
          ↷ <span>{t("redoAnnotation")}</span>
        </button>
        {history.blocked && (
          <p className="muted small">{t("annotationHistoryChanged")}</p>
        )}
        <hr />
        <button role="menuitem" onClick={onAsk}>
          ✦ <span>{t("ask")}</span>
        </button>
        <button role="menuitem" onClick={onTranslate}>
          文 <span>{t("translateSelection")}</span>
        </button>
        <button role="menuitem" onClick={onSearch}>
          ⌕ <span>{t("searchText")}</span>
        </button>
        <button role="menuitem" onClick={onCopy}>
          ▢ <span>{t("copySelection")}</span>
        </button>
      </div>
    </div>
  );
}
