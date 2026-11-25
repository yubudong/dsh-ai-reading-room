import { useRef, useEffect, useState } from "react";
import { KEY_STORE, resolveShortcut } from "../shared/shortcuts.js";
export function useReadingKeys(actions) {
  const refs = useRef(actions);
  refs.current = actions;
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY_STORE) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    const update = () => {
      try {
        setOverrides(JSON.parse(localStorage.getItem(KEY_STORE) || "{}"));
      } catch {}
    };
    window.addEventListener("arr-shortcuts-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("arr-shortcuts-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return (e) => {
    const target = e.target;
    const editable =
        target.isContentEditable ||
        !!target.closest('input,textarea,select,[contenteditable="true"]'),
      modal = !!target.closest('[role="dialog"]');
    const id = resolveShortcut(e.nativeEvent, { editable, modal, overrides });
    if (id && refs.current[id]) {
      e.preventDefault();
      e.stopPropagation();
      refs.current[id](e);
    }
  };
}
