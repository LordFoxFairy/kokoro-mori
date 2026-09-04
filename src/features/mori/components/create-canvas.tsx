"use client"

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react"
import { AudioLines, Check, Disc3, Mic2, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react"
import type { CreationMode, LyricsMode, SongPlan } from "../domain"
import { t } from "../copy"
import {
  previewInspirationPresets,
  previewReferenceAudios,
  previewVoiceProfiles,
  type MoriAudioReferenceSelection,
  type MoriCreativeSourceSelection,
  type MoriInspirationPreset,
} from "../creative-assets"
import { buildSongPlan } from "../song-plan"
import { CreativeSourceDock } from "./creative-source-dock"
import { useMoriApp } from "./mori-app-provider"
import styles from "../mori-workspace.module.css"

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
  initialCreativeSource?: MoriCreativeSourceSelection
  onModeChange: (mode: CreationMode) => void
  onGenerate: (draft: CreationDraft) => void
}

export function CreateCanvas({ projectRef, mode, initialCreativeSource, onModeChange, onGenerate }: CreateCanvasProps) {
  const { preferences } = useMoriApp()
  const initialVoiceProfile = initialCreativeSource?.kind === "voice"
    ? previewVoiceProfiles.find((profile) => profile.ref === initialCreativeSource.ref) ?? null
    : null
  const initialInspiration = initialCreativeSource?.kind === "inspiration"
    ? previewInspirationPresets.find((preset) => preset.ref === initialCreativeSource.ref) ?? null
    : null
  const initialReferenceAudio = initialCreativeSource?.kind === "audio"
    ? previewReferenceAudios.find((audio) => audio.ref === initialCreativeSource.ref) ?? null
    : null
  const smartTabRef = useRef<HTMLButtonElement>(null)
  const customTabRef = useRef<HTMLButtonElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const planPreviewRef = useRef<HTMLElement>(null)
  const [prompt, setPrompt] = useState("A warm, late-night track for the drive home, slowly opening into sunrise.")
  const [lyrics, setLyrics] = useState("")
  const [lyricsModeOverride, setLyricsModeOverride] = useState<LyricsMode | null>(null)
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
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [planPreview, setPlanPreview] = useState<ReturnType<typeof buildSongPlan> | null>(null)
  const [planEditing, setPlanEditing] = useState(false)
  const [planBackup, setPlanBackup] = useState<SongPlan | null>(null)

  const lyricsMode = lyricsModeOverride ?? preferences.lyricsMode
  const durationSeconds = durationOverride ?? preferences.durationSeconds
  const planPreviewVisible = planPreview !== null

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

  function discardPlanEdits() {
    if (planBackup !== null) setPlanPreview(planBackup)
    setPlanBackup(null)
    setPlanEditing(false)
  }

  function updatePlan(patch: Partial<SongPlan>) {
    setPlanPreview((current) => current === null ? current : { ...current, ...patch })
  }

  function startWithLyrics() {
    onModeChange("custom")
    setLyricsModeOverride("lyrics")
    clearPlanPreview()
  }

  function startInstrumental() {
    onModeChange("custom")
    setLyricsModeOverride("instrumental")
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
    onGenerate({ prompt, lyricsMode, lyrics: lyrics.trim() || undefined, style, referenceAssetRefs: referenceSource === null ? [] : [referenceSource.ref], voice, voiceRef: voiceProfileRef ?? undefined, durationSeconds })
  }

  function confirmPlan() {
    onGenerate({ prompt, lyricsMode, lyrics: lyrics.trim() || undefined, style, referenceAssetRefs: referenceSource === null ? [] : [referenceSource.ref], voice, voiceRef: voiceProfileRef ?? undefined, durationSeconds, songPlan: planPreview ?? undefined })
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

      <div className={styles.modeTabs} role="tablist" aria-label="Creation mode">
        <button ref={smartTabRef} className={styles.modeTab} id="mori-mode-smart" type="button" role="tab" aria-selected={mode === "smart"} aria-controls="mori-create-panel" tabIndex={mode === "smart" ? 0 : -1} onKeyDown={(event) => navigateMode(event, "smart")} onClick={() => { onModeChange("smart"); clearPlanPreview() }}>
          <Sparkles size={13} /> {t("smartLabel")}
        </button>
        <button ref={customTabRef} className={styles.modeTab} id="mori-mode-custom" type="button" role="tab" aria-selected={mode === "custom"} aria-controls="mori-create-panel" tabIndex={mode === "custom" ? 0 : -1} onKeyDown={(event) => navigateMode(event, "custom")} onClick={() => { onModeChange("custom"); clearPlanPreview() }}>
          <SlidersHorizontal size={13} /> {t("customLabel")}
        </button>
      </div>

      <form className={styles.composerCard} id="mori-create-panel" role="tabpanel" aria-labelledby={mode === "smart" ? "mori-mode-smart" : "mori-mode-custom"} onSubmit={submit}>
        <textarea
          className={styles.promptArea}
          value={prompt}
          onChange={(event) => { setPrompt(event.target.value); clearPlanPreview() }}
          placeholder={t("promptPlaceholder")}
          aria-label="Song idea"
        />

        <CreativeSourceDock
          referenceSource={referenceSource}
          referenceError={referenceError}
          voiceRef={voiceProfileRef}
          inspirationRef={inspirationRef}
          onChooseReference={addReference}
          onRemoveReference={removeReference}
          onVoiceChange={(nextVoiceRef) => { setVoiceProfileRef(nextVoiceRef); clearPlanPreview() }}
          onInspirationChange={chooseInspiration}
        />

        {mode === "custom" ? (
          <div className={styles.customFields}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="lyrics-mode">Lyrics or instrumental</label>
                <select className={styles.selectInput} id="lyrics-mode" value={lyricsMode} onChange={(event) => { setLyricsModeOverride(event.target.value as LyricsMode); clearPlanPreview() }}>
                  <option value="lyrics">Lyrics</option>
                  <option value="instrumental">Instrumental</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="mori-style">Style</label>
                <input className={styles.textInput} id="mori-style" value={style} onChange={(event) => { setStyle(event.target.value); setInspirationRef(null); clearPlanPreview() }} />
              </div>
            </div>
            {lyricsMode === "lyrics" ? <div className={styles.fieldRow}>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label htmlFor="mori-lyrics">Lyrics</label>
                <textarea className={styles.lyricsInput} id="mori-lyrics" value={lyrics} onChange={(event) => { setLyrics(event.target.value); clearPlanPreview() }} placeholder="Add your words, or leave this empty for Mori to write them." />
              </div>
            </div> : null}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="mori-voice">Vocal direction</label>
                <select className={styles.selectInput} id="mori-voice" value={voice} onChange={(event) => { setVoice(event.target.value); clearPlanPreview() }}>
                  <option>Natural lead</option>
                  <option>Airy alto</option>
                  <option>Warm tenor</option>
                </select>
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
          </div>
        ) : null}

        {planPreview !== null ? (
          <section ref={planPreviewRef} className={styles.songPlanPreview} role="region" aria-label="Song plan preview" tabIndex={-1}>
            <header className={styles.songPlanPreviewHeader}>
              <div>
                <div className={styles.songPlanKicker}><Sparkles size={13} /> AI draft</div>
                <h2>Song plan</h2>
              </div>
              <div className={styles.songPlanHeaderActions}>
                <span className={styles.songPlanReady}><Check size={13} /> {planEditing ? "Editing" : "Ready to review"}</span>
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
                  <span>Vocal direction</span>
                  <textarea aria-label="Vocal direction" className={styles.planEditArea} value={planPreview.vocalDirection} onChange={(event) => updatePlan({ vocalDirection: event.target.value })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>Lyrics intent</span>
                  <textarea aria-label="Lyrics intent" className={styles.planEditArea} value={planPreview.lyricsIntent} onChange={(event) => updatePlan({ lyricsIntent: event.target.value })} />
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

        <div className={styles.composerBottom}>
          <div className={styles.promptHint}><AudioLines /> <span>{planPreview === null ? "We'll turn this into an editable song plan first." : "Your plan is ready for one last look."}</span></div>
          {planPreview === null ? <button className={styles.generateButton} type="submit"><Sparkles /> {mode === "smart" ? "Review plan" : t("generateLabel")}</button> : <span className={styles.planReadyLabel}><Check size={14} /> Plan ready</span>}
        </div>
      </form>

      <div className={styles.planHint} role="note">
        <WandSparkles size={16} />
        <span><strong>Song Plan</strong> will map the mood, tempo, structure, and vocal direction before any version is made.</span>
      </div>

      <div className={styles.quickChips} aria-label="Creative shortcuts">
        <button className={styles.quickChip} type="button" onClick={startWithLyrics}><Mic2 /> Start with lyrics</button>
        <button className={styles.quickChip} type="button" onClick={startInstrumental}><Disc3 /> Start instrumental</button>
      </div>
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
