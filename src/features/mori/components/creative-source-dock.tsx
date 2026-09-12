"use client"

import { ChevronDown, FileAudio, Mic2, Plus, Sparkles, Square, X } from "lucide-react"
import { useState } from "react"
import {
  previewCreativeSources,
  type MoriAudioReferenceSelection,
  type MoriCreativeLibrarySource,
  type MoriInspirationPreset,
} from "../creative-assets"
import type { MoriCreativeSourceUploadStatus } from "@/lib/mori-api"
import type { AudioRecordingStatus } from "../use-audio-recorder"
import styles from "./creative-source-dock.module.css"

type CreativeSourceDockProps = {
  referenceSource: MoriAudioReferenceSelection | null
  referenceError: string | null
  voiceRef: string | null
  voiceEnabled: boolean
  inspirationRef: string | null
  onChooseReference: () => void
  onRemoveReference: () => void
  onRetryReference?: () => void
  onVoiceChange: (voiceRef: string | null) => void
  onInspirationChange: (preset: MoriInspirationPreset | null) => void
  creativeSources?: readonly MoriCreativeLibrarySource[]
  referenceUploadStatus?: MoriCreativeSourceUploadStatus | null
  recordingStatus?: AudioRecordingStatus
  recordingSeconds?: number
  onStartRecording?: () => void
  onStopRecording?: () => void
}

type OpenPicker = "voice" | "inspiration" | null

export function CreativeSourceDock({
  referenceSource,
  referenceError,
  voiceRef,
  voiceEnabled,
  inspirationRef,
  onChooseReference,
  onRemoveReference,
  onVoiceChange,
  onInspirationChange,
  creativeSources,
  referenceUploadStatus = null,
  recordingStatus = "idle",
  recordingSeconds = 0,
  onRetryReference,
  onStartRecording,
  onStopRecording,
}: CreativeSourceDockProps) {
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null)
  const sourceCatalog: readonly MoriCreativeLibrarySource[] = creativeSources ?? previewCreativeSources
  const voiceProfiles = sourceCatalog.filter((source) => source.sourceKind === "voice").map((source) => ({
    ref: source.ref,
    name: source.name,
    description: source.description,
  }))
  const inspirationPresets = sourceCatalog.filter((source) => source.sourceKind === "inspiration").map((source) => ({
    ref: source.ref,
    name: source.name,
    description: source.description,
    style: source.style ?? source.description,
  }))
  const selectedVoice = voiceProfiles.find((profile) => profile.ref === voiceRef) ?? null
  const selectedInspiration = inspirationPresets.find((preset) => preset.ref === inspirationRef) ?? null
  const recording = recordingStatus !== "idle"
  const referenceUploadPending = referenceUploadStatus !== null && !["ready", "failed", "cancelled", "expired"].includes(referenceUploadStatus)

  function togglePicker(picker: Exclude<OpenPicker, null>) {
    setOpenPicker((current) => current === picker ? null : picker)
  }

  return (
    <section className={styles.dock} aria-label="Creative sources">
      <header className={styles.dockHeader}>
        <h2 className={styles.dockTitle}>Creative sources</h2>
        <span className={styles.optionalLabel}>Optional</span>
      </header>

      <div className={`${styles.sourceGrid} ${voiceEnabled ? "" : styles.sourceGridTwo}`}>
        <div className={styles.sourceCell}>
          <div className={styles.sourceActions}>
            <button
              className={`${styles.sourceButton} ${referenceSource === null ? "" : `${styles.sourceButtonSelected} ${styles.sourceButtonRemovable}`}`}
              type="button"
              disabled={recording || referenceUploadPending}
              onClick={() => { setOpenPicker(null); onChooseReference() }}
              aria-label={recording ? "Recording reference audio" : referenceSource === null ? "Add audio reference" : `Replace reference audio ${referenceSource.name}`}
            >
              <span className={styles.sourceIcon}><FileAudio /></span>
              <span className={styles.sourceCopy}>
                <strong>{recording ? "Recording reference" : referenceSource?.name ?? "Audio reference"}</strong>
                <small>{recording ? `${formatRecordingDuration(recordingSeconds)} · tap Stop when you’re done` : referenceSource?.detail ?? (referenceUploadStatus === null ? "Guide rhythm, melody, or texture" : `${referenceUploadStatus} · preparing your reference`)}</small>
              </span>
              {referenceSource === null && !recording ? <Plus className={styles.sourceChevron} /> : null}
            </button>
            {referenceSource === null && recording && onStopRecording !== undefined ? (
              <button className={styles.recordButton} type="button" disabled={recordingStatus === "stopping"} onClick={onStopRecording} aria-label={recordingStatus === "stopping" ? "Finishing audio reference recording" : "Stop recording audio reference"}>
                <Square /> {recordingStatus === "stopping" ? "Preparing…" : "Stop"}
              </button>
            ) : null}
            {referenceSource === null && !recording && !referenceUploadPending && onStartRecording !== undefined ? (
              <button className={styles.recordButton} type="button" onClick={onStartRecording} aria-label="Record audio reference">
                <Mic2 /> Record
              </button>
            ) : null}
          </div>
          {referenceSource !== null ? (
            <button className={styles.sourceRemove} type="button" onClick={onRemoveReference} aria-label={`Remove reference audio ${referenceSource.name}`}>
              <X />
            </button>
          ) : null}
        </div>

        {voiceEnabled ? <div className={styles.sourceCell}>
          <button
            className={`${styles.sourceButton} ${selectedVoice === null ? "" : styles.sourceButtonSelected}`}
            type="button"
            onClick={() => togglePicker("voice")}
            aria-expanded={openPicker === "voice"}
            aria-label={selectedVoice === null ? "Choose voice profile" : `Change voice profile ${selectedVoice.name}`}
          >
            <span className={styles.sourceIcon}><Mic2 /></span>
            <span className={styles.sourceCopy}>
              <strong>{selectedVoice?.name ?? "Voice profile"}</strong>
              <small>{selectedVoice?.description ?? "Reuse a consistent vocal identity"}</small>
            </span>
            <ChevronDown className={styles.sourceChevron} />
          </button>
        </div> : null}

        <div className={styles.sourceCell}>
          <button
            className={`${styles.sourceButton} ${selectedInspiration === null ? "" : styles.sourceButtonSelected}`}
            type="button"
            onClick={() => togglePicker("inspiration")}
            aria-expanded={openPicker === "inspiration"}
            aria-label={selectedInspiration === null ? "Choose inspiration" : `Change inspiration ${selectedInspiration.name}`}
          >
            <span className={styles.sourceIcon}><Sparkles /></span>
            <span className={styles.sourceCopy}>
              <strong>{selectedInspiration?.name ?? "Inspiration"}</strong>
              <small>{selectedInspiration?.description ?? "Start from a curated creative direction"}</small>
            </span>
            <ChevronDown className={styles.sourceChevron} />
          </button>
        </div>
      </div>

      {referenceError !== null ? <p className={styles.sourceError} role="alert">{referenceError}{referenceUploadStatus === "failed" && onRetryReference !== undefined ? <button type="button" onClick={onRetryReference}>Try again</button> : null}</p> : null}

      {voiceEnabled && openPicker === "voice" ? (
        <section className={styles.pickerPanel} aria-label="Voice profiles">
          <header className={styles.pickerHeader}>
            <span className={styles.pickerHeaderCopy}>
              <strong>Voice profiles</strong>
              <small>Reusable identities stay separate from vocal direction.</small>
            </span>
            <button className={styles.pickerClose} type="button" onClick={() => setOpenPicker(null)} aria-label="Close voice profiles"><X /></button>
          </header>
          <div className={`${styles.pickerOptions} ${styles.pickerOptionsTwo}`}>
            {voiceProfiles.map((profile) => (
              <button
                className={styles.pickerOption}
                type="button"
                key={profile.ref}
                aria-label={`Use ${profile.name} voice`}
                aria-pressed={profile.ref === voiceRef}
                onClick={() => { onVoiceChange(profile.ref); setOpenPicker(null) }}
              >
                <strong>{profile.name}</strong>
                <small>{profile.description}</small>
              </button>
            ))}
          </div>
          {voiceRef !== null ? <button className={styles.pickerClear} type="button" onClick={() => { onVoiceChange(null); setOpenPicker(null) }}>Use default voice</button> : null}
        </section>
      ) : null}

      {openPicker === "inspiration" ? (
        <section className={styles.pickerPanel} aria-label="Inspiration presets">
          <header className={styles.pickerHeader}>
            <span className={styles.pickerHeaderCopy}>
              <strong>Inspiration</strong>
              <small>Choose a starting point, then keep shaping it in Style.</small>
            </span>
            <button className={styles.pickerClose} type="button" onClick={() => setOpenPicker(null)} aria-label="Close inspiration presets"><X /></button>
          </header>
          <div className={styles.pickerOptions}>
            {inspirationPresets.map((preset) => (
              <button
                className={styles.pickerOption}
                type="button"
                key={preset.ref}
                aria-label={`Use ${preset.name} inspiration`}
                aria-pressed={preset.ref === inspirationRef}
                onClick={() => { onInspirationChange(preset); setOpenPicker(null) }}
              >
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
          {inspirationRef !== null ? <button className={styles.pickerClear} type="button" onClick={() => { onInspirationChange(null); setOpenPicker(null) }}>Remove inspiration</button> : null}
        </section>
      ) : null}
    </section>
  )
}

function formatRecordingDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0")
  const remainder = Math.max(0, seconds % 60).toString().padStart(2, "0")
  return `${minutes}:${remainder}`
}
