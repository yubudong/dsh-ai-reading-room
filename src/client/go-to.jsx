import React, { useState } from "react";
export function GoTo({ t, m, close }) {
  const [number, setNumber] = useState(1);
  return (
    <div className="form">
      <label>
        {t("chapterNumber")}
        <input
          type="number"
          min="1"
          max={m.chapters.length}
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
        />
      </label>
      <button
        disabled={!m.chapters[number - 1]}
        onClick={() => {
          m.onJump({ chapterId: m.chapters[number - 1].id, start: 0, end: 1 });
          close();
        }}
      >
        {t("goTo")}
      </button>
    </div>
  );
}
