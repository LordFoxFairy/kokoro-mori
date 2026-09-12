"use client"

import { useState } from "react"
import type { CompositionEdit } from "../composition-editor"
import styles from "./composition-edit-panel.module.css"

export function CompositionEditPanel({ clipRef, trackRef, operation, onApply }: { clipRef: string; trackRef: string; operation: Exclude<CompositionEdit["operation"], "insert">; onApply: (edit: CompositionEdit) => void }) {
  const [value, setValue] = useState(0)
  const [secondaryValue, setSecondaryValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    try {
      if (operation === "move") onApply({ operation, trackRef, clipRef, startMs: value })
      else if (operation === "trim") onApply({ operation, trackRef, clipRef, durationMs: Math.max(1, value) })
      else if (operation === "split") onApply({ operation, trackRef, clipRef, atMs: Math.max(1, value) })
      else if (operation === "crop") onApply({ operation, trackRef, clipRef, startOffsetMs: Math.max(0, value), endOffsetMs: Math.max(0, secondaryValue) })
      else onApply({ operation, trackRef, clipRef, fadeInMs: Math.max(0, value), fadeOutMs: Math.max(0, secondaryValue) })
      setError(null)
    } catch { setError("This edit does not fit inside the selected clip.") }
  }
  return <form className={styles.panel} aria-label={`${operation} clip`} onSubmit={(event) => { event.preventDefault(); submit() }}>
    <label><span>{operation === "fade" ? "Fade in (ms)" : operation === "crop" ? "Crop from start (ms)" : `${operation} value (ms)`}</span><input type="number" min={operation === "move" || operation === "fade" || operation === "crop" ? 0 : 1} value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>
    {operation === "crop" ? <label><span>Crop from end (ms)</span><input type="number" min={0} value={secondaryValue} onChange={(event) => setSecondaryValue(Number(event.target.value))} /></label> : null}
    {operation === "fade" ? <label><span>Fade out (ms)</span><input type="number" min={0} value={secondaryValue} onChange={(event) => setSecondaryValue(Number(event.target.value))} /></label> : null}
    {error !== null ? <p role="alert">{error}</p> : null}
    <button type="submit">Apply {operation}</button>
  </form>
}
