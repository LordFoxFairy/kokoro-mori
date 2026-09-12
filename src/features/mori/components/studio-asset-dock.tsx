"use client"

import { AudioLines, FileAudio, Filter, Mic2, Pause, Play, Search, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import type { MoriCreativeLibrarySource } from "../creative-assets"
import { previewCreativeSources } from "../creative-assets"
import { compositionSourceDragMimeType } from "./composition-lane"
import styles from "./studio-asset-dock.module.css"

type AudioCreativeSource = Extract<MoriCreativeLibrarySource, { sourceKind: "audio" }>
type StudioAssetDockFilter = "all" | MoriCreativeLibrarySource["sourceKind"]

type StudioAssetDockProps = {
  sources?: readonly MoriCreativeLibrarySource[]
  selectedTrackName?: string
  selectedRangeLabel: string
  selectedRangeTime: string
  disabled?: boolean
  previewingSourceRef?: string | null
  onPreview: (source: AudioCreativeSource) => void
  onInsert: (source: AudioCreativeSource) => void
}

const filters: readonly { id: StudioAssetDockFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "audio", label: "Audio" },
  { id: "voice", label: "Voices" },
  { id: "inspiration", label: "Inspiration" },
]

export function StudioAssetDock({ sources, selectedTrackName, selectedRangeLabel, selectedRangeTime, disabled = false, previewingSourceRef = null, onPreview, onInsert }: StudioAssetDockProps) {
  const [filter, setFilter] = useState<StudioAssetDockFilter>("audio")
  const [query, setQuery] = useState("")
  const sourceCatalog = sources ?? previewCreativeSources
  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return sourceCatalog.filter((source) => {
      if (filter !== "all" && source.sourceKind !== filter) return false
      if (normalizedQuery === "") return true
      const style = source.sourceKind === "inspiration" ? source.style : ""
      return `${source.name} ${source.description} ${style}`.toLowerCase().includes(normalizedQuery)
    })
  }, [filter, query, sourceCatalog])

  return (
    <section className={styles.dock} aria-label="Studio asset dock">
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Library</span>
          <h3>Bring a sound into this arrangement</h3>
          <p>Preview reusable sources, then place audio into the selected track and range.</p>
        </div>
        <div className={styles.headerMark} aria-hidden="true"><AudioLines size={16} /></div>
      </header>

      <div className={styles.contextRow}>
        <div className={styles.contextCard}>
          <span>Insert target</span>
          <strong>{selectedTrackName ?? "Select a track"}</strong>
          <small>{selectedRangeLabel} · {selectedRangeTime}</small>
        </div>
        <label className={styles.searchField}>
          <Search aria-hidden="true" size={14} />
          <span className={styles.srOnly}>Search creative sources</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sources" type="search" />
        </label>
      </div>

      <div className={styles.filterBar} role="toolbar" aria-label="Filter studio assets">
        <Filter aria-hidden="true" size={13} />
        {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>

      {visibleSources.length > 0 ? <div className={styles.sourceList}>
        {visibleSources.map((source) => <SourceCard key={`${source.sourceKind}:${source.ref}`} source={source} disabled={disabled} canInsert={selectedTrackName !== undefined} previewing={previewingSourceRef === source.ref} onPreview={onPreview} onInsert={onInsert} />)}
      </div> : <div className={styles.emptyState} role="status">
        <span><Search aria-hidden="true" size={15} /></span>
        <strong>No sources match</strong>
        <small>Try another search or switch the source filter.</small>
      </div>}
    </section>
  )
}

type SourceCardProps = {
  source: MoriCreativeLibrarySource
  disabled: boolean
  canInsert: boolean
  previewing: boolean
  onPreview: (source: AudioCreativeSource) => void
  onInsert: (source: AudioCreativeSource) => void
}

function SourceCard({ source, disabled, canInsert, previewing, onPreview, onInsert }: SourceCardProps) {
  const audioSource: AudioCreativeSource | null = source.sourceKind === "audio" ? source : null
  return <article
    className={styles.sourceCard}
    data-source-kind={source.sourceKind}
    draggable={audioSource !== null && !disabled}
    onDragStart={(event) => {
      if (audioSource === null || disabled) return
      event.dataTransfer.effectAllowed = "copy"
      event.dataTransfer.setData(compositionSourceDragMimeType, JSON.stringify({ sourceRef: audioSource.ref }))
    }}
  >
    <div className={styles.sourceIcon}>{sourceIcon(source.sourceKind)}</div>
    <div className={styles.sourceCopy}>
      <div className={styles.sourceTitleRow}>
        <h4>{source.name}</h4>
        <span>{audioSource === null ? "Reference" : formatDuration(audioSource.durationSeconds)}</span>
      </div>
      <p>{source.description}</p>
      <div className={styles.sourceActions}>
        {audioSource !== null ? <>
          <button className={styles.previewButton} type="button" disabled={disabled} aria-label={`${previewing ? "Pause" : "Preview"} ${source.name}`} aria-pressed={previewing} onClick={() => onPreview(audioSource)}>
            {previewing ? <Pause aria-hidden="true" size={13} fill="currentColor" /> : <Play aria-hidden="true" size={13} fill="currentColor" />}
            {previewing ? "Pause preview" : "Preview"}
          </button>
          <button className={styles.insertButton} type="button" aria-label={canInsert ? `Insert ${source.name}` : `Select a track to insert ${source.name}`} disabled={disabled || !canInsert} onClick={() => onInsert(audioSource)}>{canInsert ? "Insert" : "Select a track"}</button>
        </> : <span className={styles.referenceOnly}><Sparkles aria-hidden="true" size={12} /> Reference only in Arrangement</span>}
      </div>
    </div>
  </article>
}

function sourceIcon(kind: MoriCreativeLibrarySource["sourceKind"]) {
  switch (kind) {
    case "audio": return <FileAudio aria-hidden="true" size={17} />
    case "voice": return <Mic2 aria-hidden="true" size={17} />
    case "inspiration": return <Sparkles aria-hidden="true" size={17} />
  }
}

function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationSeconds))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}
