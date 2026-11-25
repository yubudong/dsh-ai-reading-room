import React, { useState, useRef, useEffect } from "react";
import {
  clampPanelWidth,
  panelLimits,
  clampTocWidth,
  tocPanelLimits,
} from "../shared/reading-methods.js";
const KEY = "arr-reading-dock-width:v1";
const TOC_KEY = "arr-reading-toc-width:v1";
export function useReadingDock(toc, onBeforeLayout) {
  const containerRef = useRef(null),
    [available, setAvailable] = useState(1200),
    [preferred, setPreferred] = useState(() => {
      try {
        return Number(localStorage.getItem(KEY)) || 420;
      } catch {
        return 420;
      }
    }),
    [preferredToc, setPreferredToc] = useState(() => {
      try {
        return Number(localStorage.getItem(TOC_KEY)) || 200;
      } catch {
        return 200;
      }
    }),
    [open, setOpen] = useState(true),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setAvailable(el.clientWidth));
    observer.observe(el);
    setAvailable(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  const reservedToc = toc
      ? clampTocWidth(preferredToc, available, open ? 320 : 0)
      : 0,
    limits = panelLimits(available, reservedToc),
    width = clampPanelWidth(preferred, available, reservedToc),
    tocWidth = toc
      ? clampTocWidth(preferredToc, available, open ? width : 0)
      : 0,
    tocLimits = tocPanelLimits(available, open ? width : 0);
  function setTocWidth(value) {
    onBeforeLayout?.();
    const next = clampTocWidth(value, available, open ? width : 0);
    setPreferredToc(next);
    try {
      localStorage.setItem(TOC_KEY, String(next));
    } catch {}
  }
  function setWidth(value) {
    onBeforeLayout?.();
    const next = clampPanelWidth(value, available, tocWidth);
    setPreferred(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {}
  }
  return {
    containerRef,
    open,
    setOpen: (value) => {
      onBeforeLayout?.();
      setOpen(value);
    },
    expanded,
    setExpanded: (value) => {
      onBeforeLayout?.();
      setExpanded(value);
    },
    width,
    setWidth,
    tocWidth,
    tocPanel: { width: tocWidth, setWidth: setTocWidth, ...tocLimits },
    ...limits,
  };
}
export function DockResizer({
  dock,
  label,
  edge = "left",
  defaultWidth = 420,
  className = "",
}) {
  const drag = useRef(null),
    [active, setActive] = useState(false);
  function finish() {
    const d = drag.current;
    if (d) {
      d.body.style.cursor = d.cursor;
      d.body.style.userSelect = d.select;
      drag.current = null;
    }
    setActive(false);
  }
  useEffect(
    () => () => {
      const d = drag.current;
      if (d) {
        d.body.style.cursor = d.cursor;
        d.body.style.userSelect = d.select;
      }
    },
    [],
  );
  return (
    <div
      className={
        "arr-dock-resizer " + className + (active ? " is-dragging" : "")
      }
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={dock.min}
      aria-valuemax={dock.max}
      aria-valuenow={Math.round(dock.width)}
      tabIndex={0}
      title={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const body = e.currentTarget.ownerDocument.body;
        drag.current = {
          x: e.clientX,
          width: dock.width,
          body,
          cursor: body.style.cursor,
          select: body.style.userSelect,
        };
        body.style.cursor = "col-resize";
        body.style.userSelect = "none";
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (drag.current)
          dock.setWidth(
            drag.current.width +
              (edge === "right"
                ? e.clientX - drag.current.x
                : drag.current.x - e.clientX),
          );
      }}
      onPointerUp={(e) => {
        finish();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={() => dock.setWidth(defaultWidth)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 50 : 20;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          dock.setWidth(dock.width + (edge === "right" ? -step : step));
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          dock.setWidth(dock.width + (edge === "right" ? step : -step));
        }
        if (e.key === "Home") {
          e.preventDefault();
          dock.setWidth(dock.min);
        }
        if (e.key === "End") {
          e.preventDefault();
          dock.setWidth(dock.max);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          dock.setWidth(defaultWidth);
        }
      }}
    />
  );
}
