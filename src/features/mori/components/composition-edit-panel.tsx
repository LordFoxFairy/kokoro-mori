"use client"

import { useState } from "react"
import type { CompositionEdit } from "../composition-editor"
import styles from "./composition-edit-panel.module.css"

export function CompositionEditPanel({ clipRef, operation, onApply }: { clipRef: string; operation: Exclude<CompositionEdit["operation"], "insert">; onApply: (edit: CompositionEdit) => void }) {
  const [value, setValue] = useState(0)
  const submit = () => {
    if (operation === "move") onApply({ operation, clipRef, startMs: value })
    else if (operation === "trim") onApply({ operation, clipRef, durationMs: Math.max(1, value) })
    else if (operation === "split") onApply({ operation, clipRef, atMs: Math.max(1, value) })
    else if (operation === "crop") onApply({ operation, clipRef, startOffsetMs: Math.max(0, value), endOffsetMs: 0 })
    else onApply({ operation, clipRef, fadeInMs: Math.max(0, value), fadeOutMs: 0 })
  }
  return <form className={styles.panel} aria-label={`${operation} clip`} onSubmit={(event) => { event.preventDefault(); submit() }}>
    <label><span>{operation === "fade" ? "Fade in (ms)" : operation === "crop" ? "Crop from start (ms)" : `${operation} value (ms)`}</span><input type="number" min={operation === "move" || operation === "fade" || operation === "crop" ? 0 : 1} value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>
    <button type="submit">Apply {operation}</button>
  </form>
}
