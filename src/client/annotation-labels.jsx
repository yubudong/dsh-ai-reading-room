import React, { useState } from "react";
import {
  ANNOTATION_COLORS,
  ANNOTATION_PALETTE,
} from "../shared/annotations.js";
import { rpc, request } from "./api.js";
export function AnnotationLabels({ data, t, run, refresh }) {
  const [labels, setLabels] = useState(
      data.preferences?.annotationLabels || {},
    ),
    [saved, setSaved] = useState(false);
  return (
    <section className="card form" style={{ marginTop: 20 }}>
      <h2>{t("colorNames")}</h2>
      <p className="muted">{t("colorNamesHint")}</p>
      {ANNOTATION_COLORS.map((c) => (
        <label className="row" key={c}>
          <span
            className="arr-annotation-badge"
            style={{ "--arr-dot": ANNOTATION_PALETTE[c] }}
          />
          <span>{t("ann_" + c)}</span>
          <input
            value={labels[c] || ""}
            maxLength={40}
            placeholder={t("optionalColorName")}
            onChange={(e) => {
              setLabels((old) => ({ ...old, [c]: e.target.value }));
              setSaved(false);
            }}
          />
        </label>
      ))}
      <button
        onClick={() =>
          run(async () => {
            await rpc({
              action: "preferences",
              item: { annotationLabels: labels },
              requestId: request(),
            });
            await refresh();
            setSaved(true);
          })
        }
      >
        {t("save")}
      </button>
      {saved && <small role="status">{t("saved")}</small>}
    </section>
  );
}
