"use client"

import { Volume2, VolumeX } from "lucide-react"
import { useState } from "react"
import { compositionTrackMix, type CompositionTrack, type CompositionTrackMix } from "../composition"
import styles from "./composition-track-mix-panel.module.css"

type CompositionTrackMixPanelProps = {
  track: CompositionTrack
  disabled?: boolean
  onApply: (mix: CompositionTrackMix) => void
}

export function CompositionTrackMixPanel({ track, disabled = false, onApply }: CompositionTrackMixPanelProps) {
  const initialMix = compositionTrackMix(track)
  const [gain, setGain] = useState(initialMix.gain)
  const [pan, setPan] = useState(initialMix.pan)
  const [muted, setMuted] = useState(initialMix.muted)

  const dirty = gain !== initialMix.gain || pan !== initialMix.pan || muted !== initialMix.muted

  return <details className={styles.panel}>
    <summary className={styles.summary}>
      <span>Track controls</span>
      <strong>{track.name}</strong>
      <small>{dirty ? "Unsaved" : "Saved"}</small>
    </summary>
    <div className={styles.controls}>
      <label className={styles.control}>
        <span>Level</span>
        <input aria-label={`Level ${track.name}`} type="range" min={0} max={100} value={Math.round(gain * 100)} disabled={disabled} onChange={(event) => setGain(Number(event.target.value) / 100)} />
        <output>{Math.round(gain * 100)}%</output>
      </label>
      <label className={styles.control}>
        <span>Pan</span>
        <input aria-label={`Pan ${track.name}`} type="range" min={-100} max={100} value={Math.round(pan * 100)} disabled={disabled} onChange={(event) => setPan(Number(event.target.value) / 100)} />
        <output>{formatPan(pan)}</output>
      </label>
      <div className={styles.actions}>
        <button className={styles.mute} type="button" aria-pressed={muted} aria-label={`${muted ? "Unmute" : "Mute"} ${track.name}`} disabled={disabled} onClick={() => setMuted((current) => !current)}>{muted ? <VolumeX size={13} /> : <Volume2 size={13} />} {muted ? "Muted" : "Mute"}</button>
        <button className={styles.apply} type="button" disabled={disabled || !dirty} onClick={() => onApply({ gain, pan, muted })}>Apply track mix</button>
      </div>
    </div>
    <p className={styles.note}>Applies on the next arrangement render. Non-destructive.</p>
  </details>
}

function formatPan(pan: number): string {
  if (pan === 0) return "Center"
  return pan < 0 ? `L ${Math.round(Math.abs(pan) * 100)}` : `R ${Math.round(pan * 100)}`
}
