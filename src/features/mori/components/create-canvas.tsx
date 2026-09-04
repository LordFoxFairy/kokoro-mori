"use client"

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react"
import { AudioLines, Check, Disc3, Mic2, SlidersHorizontal, Sparkles } from "lucide-react"
import type { CreationMode, LyricsMode, SongPlan } from "../domain"
import { t } from "../copy"
import {
  previewCreativeSources,
  type MoriAudioReferenceSelection,
  type MoriCreativeLibrarySource,
  type MoriCreativeSourceSelection,
  type MoriInspirationPreset,
} from "../creative-assets"
import { buildSongPlan } from "../song-plan"
import { CreativeSourceDock } from "./creative-source-dock"
import { useMoriApp } from "./mori-app-provider"
import styles from "../mori-workspace.module.css"

const DEFAULT_PROMPT = "A warm, late-night track for the drive home, slowly opening into sunrise."

export type CreationDraft = {
  prompt: string
  lyricsMode: LyricsMode
  lyrics?: string
  style: string
  referenceAssetRefs: string[]
  voice: string
  voiceRef?: string
  durationSeconds: number
  songPlan?: SongPlan
}

type CreateCanvasProps = {
  projectRef: string
  mode: CreationMode
  initialPrompt?: string
  initialCreativeSource?: MoriCreativeSourceSelection
  creativeSources?: readonly MoriCreativeLibrarySource[]
  onModeChange: (mode: CreationMode) => void
  onGenerate: (draft: CreationDraft) => void
}

export function CreateCanvas({ projectRef, mode, initialPrompt, initialCreativeSource, creativeSources, onModeChange, onGenerate }: CreateCanvasProps) {
  const { preferences } = useMoriApp()
  const sourceCatalog: readonly MoriCreativeLibrarySource[] = creativeSources ?? previewCreativeSources
  const initialVoiceProfile = initialCreativeSource?.kind === "voice"
    ? sourceCatalog.find((source) => source.sourceKind === "voice" && source.ref === initialCreativeSource.ref) ?? null
    : null
  const initialInspiration = initialCreativeSource?.kind === "inspiration"
    ? sourceCatalog.find((source) => source.sourceKind === "inspiration" && source.ref === initialCreativeSource.ref) ?? null
    : null
  const initialReferenceAudio = initialCreativeSource?.kind === "audio"
    ? sourceCatalog.find((source) => source.sourceKind === "audio" && source.ref === initialCreativeSource.ref) ?? null
    : null
  const smartTabRef = useRef<HTMLButtonElement>(null)
  const customTabRef = useRef<HTMLButtonElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const planPreviewRef = useRef<HTMLElement>(null)
  const [prompt, setPrompt] = useState(() => initialPrompt?.trim() || DEFAULT_PROMPT)
  const [lyrics, setLyrics] = useState("")
  const [lyricsModeOverride, setLyricsModeOverride] = useState<LyricsMode | null>(initialVoiceProfile === null ? null : "lyrics")
  const [style, setStyle] = useState(initialInspiration?.style ?? "Dream pop · intimate · organic")
  const [voice, setVoice] = useState("Natural lead")
  const [voiceProfileRef, setVoiceProfileRef] = useState<string | null>(initialVoiceProfile?.ref ?? null)
  const [inspirationRef, setInspirationRef] = useState<string | null>(initialInspiration?.ref ?? null)
  const [durationOverride, setDurationOverride] = useState<number | null>(null)
  const [referenceSource, setReferenceSource] = useState<MoriAudioReferenceSelection | null>(() => initialReferenceAudio === null ? null : {
    ref: initialReferenceAudio.ref,
    name: initialReferenceAudio.name,
    detail: `${initialReferenceAudio.description} · from Library`,
  })
  const initialSourceAppliedRef = useRef<string | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [planPreview, setPlanPreview] = useState<ReturnType<typeof buildSongPlan> | null>(null)
  const [planEditing, setPlanEditing] = useState(false)
  const [planBackup, setPlanBackup] = useState<SongPlan | null>(null)

  const lyricsMode = lyricsModeOverride ?? preferences.lyricsMode
  const durationSeconds = durationOverride ?? preferences.durationSeconds
  const planPreviewVisible = planPreview !== null

  useEffect(() => {
    if (initialCreativeSource === undefined) return
    const sourceKey = `${initialCreativeSource.kind}:${initialCreativeSource.ref}`
    if (initialSourceAppliedRef.current === sourceKey) return
    const source = sourceCatalog.find((item) => item.sourceKind === initialCreativeSource.kind && item.ref === initialCreativeSource.ref)
    if (source === undefined) return
    initialSourceAppliedRef.current = sourceKey
    const frame = window.requestAnimationFrame(() => {
      if (source.sourceKind === "voice") {
        setLyricsModeOverride("lyrics")
        setVoiceProfileRef(source.ref)
      } else if (source.sourceKind === "inspiration") {
        setStyle(source.style ?? source.description)
        setInspirationRef(source.ref)
      } else {
        setReferenceSource({ ref: source.ref, name: source.name, detail: `${source.description} · from Library` })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialCreativeSource, sourceCatalog])

  useEffect(() => {
    if (!planPreviewVisible) return
    const frame = window.requestAnimationFrame(() => {
      const preview = planPreviewRef.current
      if (preview === null) return
      preview.focus({ preventScroll: true })
      preview.scrollIntoView?.({
        behavior: preferences.reduceMotion ? "auto" : "smooth",
        block: "start",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [planPreviewVisible, preferences.reduceMotion])

  function clearPlanPreview() {
    setPlanPreview(null)
    setPlanEditing(false)
    setPlanBackup(null)
  }

  function openPlanEditor() {
    if (planPreview === null) return
    setPlanBackup(planPreview)
    setPlanEditing(true)
  }

  function returnToIdea() {
    clearPlanPreview()
    window.requestAnimationFrame(() => promptRef.current?.focus())
  }

  function discardPlanEdits() {
    if (planBackup !== null) setPlanPreview(planBackup)
    setPlanBackup(null)
    setPlanEditing(false)
  }

  function updatePlan(patch: Partial<SongPlan>) {
    setPlanPreview((current) => current === null ? current : { ...current, ...patch })
  }

  function chooseOutput(nextLyricsMode: LyricsMode) {
    setLyricsModeOverride(nextLyricsMode)
    clearPlanPreview()
  }

  function addReference() {
    referenceInputRef.current?.click()
  }

  function changeReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (file === undefined) return
    if (!isAudioReference(file)) {
      setReferenceError("Choose an MP3, WAV, M4A, FLAC, AAC, or OGG audio file.")
      event.currentTarget.value = ""
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setReferenceError("Reference audio must be 50 MB or smaller.")
      event.currentTarget.value = ""
      return
    }

    setReferenceSource({
      ref: "asset_preview_reference",
      name: file.name,
      detail: `${formatFileSize(file.size)} · selected for this direction`,
    })
    setReferenceError(null)
    clearPlanPreview()
  }

  function removeReference() {
    setReferenceSource(null)
    setReferenceError(null)
    if (referenceInputRef.current !== null) referenceInputRef.current.value = ""
    clearPlanPreview()
  }

  function chooseInspiration(preset: MoriInspirationPreset | null) {
    setInspirationRef(preset?.ref ?? null)
    if (preset !== null) setStyle(preset.style)
    clearPlanPreview()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "smart" && planPreview === null) {
      setPlanPreview(buildSongPlan(projectRef, { prompt, lyricsMode, style, voice, durationSeconds }))
      return
    }
    onGenerate(toCreationDraft())
  }

  function confirmPlan() {
    if (planPreview !== null) onGenerate(toCreationDraft(planPreview))
  }

  function toCreationDraft(songPlan?: SongPlan): CreationDraft {
    const normalizedLyrics = lyrics.trim()
    return {
      prompt,
      lyricsMode,
      style,
      referenceAssetRefs: referenceSource === null ? [] : [referenceSource.ref],
      voice,
      durationSeconds,
      ...(lyricsMode === "lyrics" && normalizedLyrics !== "" ? { lyrics: normalizedLyrics } : {}),
      ...(lyricsMode === "lyrics" && voiceProfileRef !== null ? { voiceRef: voiceProfileRef } : {}),
      ...(songPlan === undefined ? {} : { songPlan }),
    }
  }

  function navigateMode(event: KeyboardEvent<HTMLButtonElement>, currentMode: CreationMode) {
    const nextMode = modeForKey(event.key, currentMode)
    if (nextMode === null) return
    event.preventDefault()
    onModeChange(nextMode)
    const nextTab = nextMode === "smart" ? smartTabRef.current : customTabRef.current
    nextTab?.focus()
    clearPlanPreview()
  }

  return (
    <section aria-labelledby="mori-create-title">
      <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Your creative space</div>
      <h1 className={styles.heroTitle} id="mori-create-title">{t("heroTitle")}</h1>
      <p className={styles.heroDescription}>{t("heroDescription")}</p>

      <div className={styles.creationSetup}>
        <div className={styles.creationChoice}>
          <span className={styles.creationChoiceLabel}>Approach</span>
          <div className={styles.modeTabs} role="tablist" aria-label="Creation mode">
            <button ref={smartTabRef} className={styles.modeTab} id="mori-mode-smart" type="button" role="tab" aria-selected={mode === "smart"} aria-controls="mori-create-panel" tabIndex={mode === "smart" ? 0 : -1} onKeyDown={(event) => navigateMode(event, "smart")} onClick={() => { onModeChange("smart"); clearPlanPreview() }}>
              <Sparkles size={13} /> {t("smartLabel")}
            </button>
            <button ref={customTabRef} className={styles.modeTab} id="mori-mode-custom" type="button" role="tab" aria-selected={mode === "custom"} aria-controls="mori-create-panel" tabIndex={mode === "custom" ? 0 : -1} onKeyDown={(event) => navigateMode(event, "custom")} onClick={() => { onModeChange("custom"); clearPlanPreview() }}>
              <SlidersHorizontal size={13} /> {t("customLabel")}
            </button>
          </div>
        </div>
        <div className={styles.creationChoice}>
          <span className={styles.creationChoiceLabel}>Output</span>
          <div className={styles.outputTabs} role="group" aria-label="Output type">
            <button className={styles.outputTab} type="button" aria-pressed={lyricsMode === "lyrics"} onClick={() => chooseOutput("lyrics")}>
              <Mic2 size={13} /> Song with lyrics
            </button>
            <button className={styles.outputTab} type="button" aria-pressed={lyricsMode === "instrumental"} onClick={() => chooseOutput("instrumental")}>
              <Disc3 size={13} /> Instrumental
            </button>
          </div>
        </div>
      </div>

      <form className={styles.composerCard} id="mori-create-panel" role="tabpanel" aria-labelledby={mode === "smart" ? "mori-mode-smart" : "mori-mode-custom"} onSubmit={submit}>
        {planPreview === null ? <>
          <textarea
            ref={promptRef}
            className={styles.promptArea}
            value={prompt}
            onChange={(event) => { setPrompt(event.target.value); clearPlanPreview() }}
            placeholder={t("promptPlaceholder")}
            aria-label="Song idea"
            maxLength={1000}
          />

          <CreativeSourceDock
            key={lyricsMode}
            referenceSource={referenceSource}
            referenceError={referenceError}
            voiceRef={voiceProfileRef}
            voiceEnabled={lyricsMode === "lyrics"}
            inspirationRef={inspirationRef}
            onChooseReference={addReference}
            onRemoveReference={removeReference}
            onVoiceChange={(nextVoiceRef) => { setVoiceProfileRef(nextVoiceRef); clearPlanPreview() }}
            onInspirationChange={chooseInspiration}
            creativeSources={sourceCatalog}
          />

          {mode === "custom" ? (
            <div className={styles.customFields}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="mori-style">Style</label>
                  <input className={styles.textInput} id="mori-style" value={style} onChange={(event) => { setStyle(event.target.value); setInspirationRef(null); clearPlanPreview() }} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="mori-duration">Duration</label>
                  <select className={styles.selectInput} id="mori-duration" value={durationSeconds} onChange={(event) => { setDurationOverride(Number(event.target.value)); clearPlanPreview() }}>
                    <option value={120}>2:00</option>
                    <option value={180}>3:00</option>
                    <option value={240}>4:00</option>
                    <option value={300}>5:00</option>
                  </select>
                </div>
              </div>
              {lyricsMode === "lyrics" ? <div className={styles.fieldRow}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="mori-lyrics">Lyrics</label>
                  <textarea className={styles.lyricsInput} id="mori-lyrics" value={lyrics} onChange={(event) => { setLyrics(event.target.value); clearPlanPreview() }} placeholder="Add your words, or leave this empty for Mori to write them." />
                </div>
              </div> : null}
              {lyricsMode === "lyrics" ? <div className={styles.fieldRow}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="mori-voice">Vocal direction</label>
                  <select className={styles.selectInput} id="mori-voice" value={voice} onChange={(event) => { setVoice(event.target.value); clearPlanPreview() }}>
                    <option>Natural lead</option>
                    <option>Airy alto</option>
                    <option>Warm tenor</option>
                  </select>
                </div>
              </div> : null}
            </div>
          ) : null}

          <div className={styles.composerBottom}>
            <div className={styles.promptHint}><AudioLines /> <span>{mode === "smart" ? "Review an editable plan before creating." : "Your controls go straight to the generation queue."}</span></div>
            <button className={styles.generateButton} type="submit"><Sparkles /> {mode === "smart" ? "Review plan" : t("generateLabel")}</button>
          </div>
        </> : null}

        {planPreview !== null ? (
          <section ref={planPreviewRef} className={styles.songPlanPreview} role="region" aria-label="Song plan preview" tabIndex={-1}>
            <header className={styles.songPlanPreviewHeader}>
              <div>
                <div className={styles.songPlanKicker}><Sparkles size={13} /> AI draft</div>
                <h2>Song plan</h2>
              </div>
              <div className={styles.songPlanHeaderActions}>
                <span className={styles.songPlanReady}><Check size={13} /> {planEditing ? "Editing" : "Ready to review"}</span>
                <button className={styles.planEditButton} type="button" onClick={returnToIdea}>Back to idea</button>
                <button className={styles.planEditButton} type="button" onClick={planEditing ? discardPlanEdits : openPlanEditor}>
                  {planEditing ? "Cancel edits" : "Edit plan"}
                </button>
              </div>
            </header>
            <p className={styles.songPlanPrompt}>{planPreview.prompt}</p>
            {planEditing ? (
              <div className={styles.songPlanEditGrid}>
                <label className={styles.songPlanEditField}>
                  <span>Mood</span>
                  <input aria-label="Plan mood" className={styles.textInput} value={planPreview.mood} onChange={(event) => updatePlan({ mood: event.target.value })} />
                </label>
                <label className={styles.songPlanEditField}>
                  <span>Tempo (BPM)</span>
                  <input aria-label="Plan tempo" className={styles.textInput} type="number" min={40} max={240} step={1} value={planPreview.tempoBpm} onChange={(event) => updatePlan({ tempoBpm: boundedTempo(event.target.value, planPreview.tempoBpm) })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>Structure</span>
                  <input aria-label="Plan structure" className={styles.textInput} value={planPreview.structure.join(", ")} onChange={(event) => updatePlan({ structure: parsePlanList(event.target.value, planPreview.structure) })} />
                  <small>Separate sections with commas.</small>
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>Palette</span>
                  <input aria-label="Plan palette" className={styles.textInput} value={planPreview.instruments.join(", ")} onChange={(event) => updatePlan({ instruments: parsePlanList(event.target.value, planPreview.instruments) })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>{lyricsMode === "instrumental" ? "Arrangement direction" : "Vocal direction"}</span>
                  <textarea aria-label={lyricsMode === "instrumental" ? "Arrangement direction" : "Vocal direction"} className={styles.planEditArea} value={planPreview.vocalDirection} onChange={(event) => updatePlan({ vocalDirection: event.target.value })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>{lyricsMode === "instrumental" ? "Creative intent" : "Lyrics intent"}</span>
                  <textarea aria-label={lyricsMode === "instrumental" ? "Creative intent" : "Lyrics intent"} className={styles.planEditArea} value={planPreview.lyricsIntent} onChange={(event) => updatePlan({ lyricsIntent: event.target.value })} />
                </label>
              </div>
            ) : (
              <>
                <div className={styles.songPlanStats}>
                  <div><span>Mood</span><strong>{planPreview.mood}</strong></div>
                  <div><span>Tempo</span><strong>{planPreview.tempoBpm} BPM</strong></div>
                  <div><span>Output</span><strong>{lyricsMode === "instrumental" ? "Instrumental" : "Lyrics"}</strong></div>
                </div>
                <div className={styles.songPlanRows}>
                  <div><span>Structure</span><div className={styles.tagRow}>{planPreview.structure.map((item) => <span className={`${styles.tag} ${styles.tagSelected}`} key={item}>{item}</span>)}</div></div>
                  <div><span>Palette</span><div className={styles.tagRow}>{planPreview.instruments.map((item) => <span className={styles.tag} key={item}>{item}</span>)}</div></div>
                </div>
                <p className={styles.songPlanDirection}>{planPreview.vocalDirection}</p>
              </>
            )}
            <footer className={styles.songPlanActions}>
              {planEditing ? <span className={styles.planEditHint}>Changes apply to this creation only.</span> : null}
              <button className={styles.generateButton} type="button" onClick={confirmPlan}><Check size={14} /> Create from this plan</button>
            </footer>
          </section>
        ) : null}
      </form>

      <input ref={referenceInputRef} className={styles.srOnly} type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.aac,.ogg" onChange={changeReference} aria-label="Reference audio file" />
    </section>
  )
}

function modeForKey(key: string, currentMode: CreationMode): CreationMode | null {
  if (key === "Home") return "smart"
  if (key === "End") return "custom"
  if (key === "ArrowRight" || key === "ArrowDown") return currentMode === "smart" ? "custom" : "smart"
  if (key === "ArrowLeft" || key === "ArrowUp") return currentMode === "smart" ? "custom" : "smart"
  return null
}

function boundedTempo(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(40, Math.min(240, Math.round(parsed))) : fallback
}

function parsePlanList(value: string, fallback: readonly string[]): string[] {
  const items = value.split(",").map((item) => item.trim()).filter((item) => item !== "")
  return items.length > 0 ? items : [...fallback]
}

function isAudioReference(file: File): boolean {
  return file.type.startsWith("audio/") || /\.(?:mp3|wav|m4a|flac|aac|ogg)$/iu.test(file.name)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
