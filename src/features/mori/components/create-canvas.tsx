"use client"

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react"
import { AlertCircle, AudioLines, Check, Disc3, LoaderCircle, Mic2, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react"
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
import { idleProjectWorkspaceSaveRun, type ProjectWorkspaceSaveRun } from "../project-workspace-memory"
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
  planPersistence?: "workspace" | "preview" | "unavailable"
  planSaveRun?: ProjectWorkspaceSaveRun
  planSaveLoading?: boolean
  workspacePlanRefresh?: { token: number; plan: SongPlan | null }
  onModeChange: (mode: CreationMode) => void
  onGenerate: (draft: CreationDraft) => void | Promise<void>
  onRetryPlanSave?: () => void
  onRefreshPlanWorkspace?: () => void | Promise<void>
}

export function CreateCanvas({ projectRef, mode, initialPrompt, initialCreativeSource, creativeSources, planPersistence = "preview", planSaveRun = idleProjectWorkspaceSaveRun, planSaveLoading = false, workspacePlanRefresh, onModeChange, onGenerate, onRetryPlanSave, onRefreshPlanWorkspace }: CreateCanvasProps) {
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
  const [planActionPending, setPlanActionPending] = useState(false)
  const [planSubmitAttempted, setPlanSubmitAttempted] = useState(false)
  const [planDirtySinceSave, setPlanDirtySinceSave] = useState(false)
  const [planValidationError, setPlanValidationError] = useState<string | null>(null)

  const lyricsMode = lyricsModeOverride ?? preferences.lyricsMode
  const durationSeconds = durationOverride ?? preferences.durationSeconds
  const planPreviewVisible = planPreview !== null
  const planBusy = planActionPending || planSaveLoading || planSaveRun.status === "saving"
  const visiblePlanSaveRun = planSubmitAttempted ? planSaveRun : idleProjectWorkspaceSaveRun
  const workspacePlanRefreshToken = workspacePlanRefresh?.token ?? null
  const refreshedWorkspacePlan = workspacePlanRefresh?.plan ?? null

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

  useEffect(() => {
    if (workspacePlanRefreshToken === null) return
    const frame = window.requestAnimationFrame(() => {
      setPlanPreview(refreshedWorkspacePlan)
      setPlanEditing(false)
      setPlanBackup(null)
      setPlanSubmitAttempted(false)
      setPlanDirtySinceSave(false)
      setPlanValidationError(null)
      if (refreshedWorkspacePlan === null) promptRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [refreshedWorkspacePlan, workspacePlanRefreshToken])

  function clearPlanPreview() {
    if (planBusy) return
    setPlanPreview(null)
    setPlanEditing(false)
    setPlanBackup(null)
    setPlanSubmitAttempted(false)
    setPlanDirtySinceSave(false)
    setPlanValidationError(null)
  }

  function openPlanEditor() {
    if (planPreview === null || planBusy) return
    setPlanBackup(planPreview)
    setPlanEditing(true)
  }

  function returnToIdea() {
    if (planBusy) return
    clearPlanPreview()
    window.requestAnimationFrame(() => promptRef.current?.focus())
  }

  function discardPlanEdits() {
    if (planBusy) return
    if (planBackup !== null) setPlanPreview(planBackup)
    setPlanBackup(null)
    setPlanEditing(false)
    setPlanDirtySinceSave(false)
    setPlanValidationError(null)
  }

  function updatePlan(patch: Partial<SongPlan>) {
    if (planBusy) return
    setPlanSubmitAttempted(false)
    setPlanDirtySinceSave(true)
    setPlanValidationError(null)
    setPlanPreview((current) => current === null ? current : { ...current, ...patch })
  }

  function chooseOutput(nextLyricsMode: LyricsMode) {
    if (planBusy) return
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
    if (planBusy) return
    if (mode === "smart" && planPreview === null) {
      setPlanSubmitAttempted(false)
      setPlanDirtySinceSave(false)
      setPlanValidationError(null)
      setPlanPreview(buildSongPlan(projectRef, { prompt, lyricsMode, style, voice, durationSeconds }))
      return
    }
    if (mode === "smart" && planPreview !== null) {
      void confirmPlan()
      return
    }
    onGenerate(toCreationDraft())
  }

  async function confirmPlan() {
    if (planPreview === null || planBusy) return
    const validationError = validateSongPlan(planPreview)
    if (validationError !== null) {
      setPlanValidationError(validationError)
      setPlanSubmitAttempted(false)
      return
    }
    setPlanValidationError(null)
    setPlanSubmitAttempted(true)
    setPlanDirtySinceSave(false)
    setPlanActionPending(true)
    try {
      await onGenerate(toCreationDraft(planPreview))
    } finally {
      setPlanActionPending(false)
    }
  }

  async function retryPlanSave() {
    if (onRetryPlanSave === undefined || planBusy) return
    setPlanSubmitAttempted(true)
    setPlanActionPending(true)
    try {
      await onRetryPlanSave()
    } finally {
      setPlanActionPending(false)
    }
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
    if (planBusy) return
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
            <button ref={smartTabRef} className={styles.modeTab} id="mori-mode-smart" type="button" role="tab" aria-selected={mode === "smart"} aria-controls="mori-create-panel" tabIndex={mode === "smart" ? 0 : -1} disabled={planBusy} onKeyDown={(event) => navigateMode(event, "smart")} onClick={() => { if (planBusy) return; onModeChange("smart"); clearPlanPreview() }}>
              <Sparkles size={13} /> {t("smartLabel")}
            </button>
            <button ref={customTabRef} className={styles.modeTab} id="mori-mode-custom" type="button" role="tab" aria-selected={mode === "custom"} aria-controls="mori-create-panel" tabIndex={mode === "custom" ? 0 : -1} disabled={planBusy} onKeyDown={(event) => navigateMode(event, "custom")} onClick={() => { if (planBusy) return; onModeChange("custom"); clearPlanPreview() }}>
              <SlidersHorizontal size={13} /> {t("customLabel")}
            </button>
          </div>
        </div>
        <div className={styles.creationChoice}>
          <span className={styles.creationChoiceLabel}>Output</span>
          <div className={styles.outputTabs} role="group" aria-label="Output type">
            <button className={styles.outputTab} type="button" aria-pressed={lyricsMode === "lyrics"} disabled={planBusy} onClick={() => chooseOutput("lyrics")}>
              <Mic2 size={13} /> Song with lyrics
            </button>
            <button className={styles.outputTab} type="button" aria-pressed={lyricsMode === "instrumental"} disabled={planBusy} onClick={() => chooseOutput("instrumental")}>
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

          <div className={styles.composerBottom}>
            <div className={styles.promptHint}><AudioLines /> <span>{mode === "smart" ? "Review an editable plan before creating." : "Your controls go straight to the generation queue."}</span></div>
            <button className={styles.generateButton} type="submit"><Sparkles /> {mode === "smart" ? "Review plan" : t("generateLabel")}</button>
          </div>
        </> : null}

        {planPreview !== null ? (
          <section ref={planPreviewRef} className={styles.songPlanPreview} role="region" aria-label="Song plan preview" tabIndex={-1} aria-busy={planBusy}>
            <header className={styles.songPlanPreviewHeader}>
              <div>
                <div className={styles.songPlanKicker}><Sparkles size={13} /> AI draft</div>
                <h2>Song plan</h2>
              </div>
              <div className={styles.songPlanHeaderActions}>
                <span className={`${styles.songPlanReady} ${visiblePlanSaveRun.status === "failed" ? styles.songPlanReadyError : ""}`} role="status" aria-live="polite">
                  {planSaveLoading || visiblePlanSaveRun.status === "saving"
                    ? <><LoaderCircle size={13} /> Saving to project</>
                    : visiblePlanSaveRun.status === "failed"
                      ? <><AlertCircle size={13} /> Needs attention</>
                      : visiblePlanSaveRun.status === "saved" && !planDirtySinceSave
                        ? <><Check size={13} /> Saved to project</>
                        : planPersistence === "workspace"
                          ? <><Check size={13} /> Ready to save</>
                          : planPersistence === "unavailable"
                            ? <><AlertCircle size={13} /> Project save unavailable</>
                            : <><Sparkles size={13} /> Preview plan</>}
                </span>
                <button className={styles.planEditButton} type="button" disabled={planBusy} onClick={returnToIdea}>Back to idea</button>
                <button className={styles.planEditButton} type="button" disabled={planBusy} onClick={planEditing ? discardPlanEdits : openPlanEditor}>
                  {planEditing ? "Cancel edits" : "Edit plan"}
                </button>
              </div>
            </header>
            <p className={styles.songPlanPrompt}>{planPreview.prompt}</p>
            {planEditing ? (
              <div className={styles.songPlanEditGrid}>
                <label className={styles.songPlanEditField}>
                  <span>Mood</span>
                  <input aria-label="Plan mood" className={styles.textInput} maxLength={120} value={planPreview.mood} disabled={planBusy} onChange={(event) => updatePlan({ mood: event.target.value })} />
                </label>
                <label className={styles.songPlanEditField}>
                  <span>Tempo (BPM)</span>
                  <input aria-label="Plan tempo" className={styles.textInput} type="number" min={40} max={240} step={1} value={planPreview.tempoBpm} disabled={planBusy} onChange={(event) => updatePlan({ tempoBpm: boundedTempo(event.target.value, planPreview.tempoBpm) })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>Structure</span>
                  <input aria-label="Plan structure" className={styles.textInput} maxLength={1300} value={planPreview.structure.join(", ")} disabled={planBusy} onChange={(event) => updatePlan({ structure: parsePlanList(event.target.value, planPreview.structure) })} />
                  <small>Separate sections with commas.</small>
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>Palette</span>
                  <input aria-label="Plan palette" className={styles.textInput} maxLength={1300} value={planPreview.instruments.join(", ")} disabled={planBusy} onChange={(event) => updatePlan({ instruments: parsePlanList(event.target.value, planPreview.instruments) })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>{lyricsMode === "instrumental" ? "Arrangement direction" : "Vocal direction"}</span>
                  <textarea aria-label={lyricsMode === "instrumental" ? "Arrangement direction" : "Vocal direction"} className={styles.planEditArea} maxLength={500} value={planPreview.vocalDirection} disabled={planBusy} onChange={(event) => updatePlan({ vocalDirection: event.target.value })} />
                </label>
                <label className={`${styles.songPlanEditField} ${styles.songPlanEditFieldWide}`}>
                  <span>{lyricsMode === "instrumental" ? "Creative intent" : "Lyrics intent"}</span>
                  <textarea aria-label={lyricsMode === "instrumental" ? "Creative intent" : "Lyrics intent"} className={styles.planEditArea} maxLength={1000} value={planPreview.lyricsIntent} disabled={planBusy} onChange={(event) => updatePlan({ lyricsIntent: event.target.value })} />
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
            {planValidationError !== null ? <div className={styles.songPlanValidationNotice} role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{planValidationError}</span>
            </div> : null}
            {planPersistence !== "preview" && visiblePlanSaveRun.status === "failed" ? <div className={styles.songPlanSaveNotice} role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{visiblePlanSaveRun.message ?? "Mori could not save this Project plan."}</span>
              {visiblePlanSaveRun.retryable && onRetryPlanSave !== undefined
                ? <button type="button" disabled={planBusy} onClick={() => { void retryPlanSave() }}>Retry save <RotateCcw size={12} /></button>
                : onRefreshPlanWorkspace !== undefined
                  ? <button type="button" disabled={planBusy} onClick={() => { void onRefreshPlanWorkspace() }}>Refresh workspace <RotateCcw size={12} /></button>
                  : null}
            </div> : null}
            <footer className={styles.songPlanActions}>
              {planEditing ? <span className={styles.planEditHint}>{visiblePlanSaveRun.status === "saved" && !planDirtySinceSave ? "Saved as the current Project plan." : planPersistence === "preview" ? "Changes apply to this creation only." : "Changes will be saved to this Project when you create."}</span> : null}
              {planPersistence === "preview" ? <span className={styles.planPersistenceHint}>Preview only · not saved to Project workspace.</span> : null}
              {planPersistence === "unavailable" ? <span className={styles.planPersistenceHint}>Project workspace saving is not connected.</span> : null}
              <button className={styles.generateButton} type="button" disabled={planBusy} onClick={() => { void confirmPlan() }}>
                {planSaveLoading || visiblePlanSaveRun.status === "saving"
                  ? <><LoaderCircle size={14} /> Saving plan…</>
                  : <><Check size={14} /> Create from this plan</>}
              </button>
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

function validateSongPlan(plan: SongPlan): string | null {
  if (plan.prompt.trim() === "") return "Add a song idea before creating."
  if (plan.mood.trim() === "") return "Add a mood so Mori can shape the direction."
  if (plan.mood.length > 120) return "Keep the mood under 120 characters."
  if (!Number.isInteger(plan.tempoBpm) || plan.tempoBpm < 40 || plan.tempoBpm > 240) return "Set a tempo between 40 and 240 BPM."
  if (plan.structure.length === 0 || plan.structure.some((item) => item.trim() === "" || item.length > 80)) return "Each structure section must be 1–80 characters."
  if (plan.structure.length > 16) return "Keep the structure to 16 sections or fewer."
  if (plan.instruments.some((item) => item.trim() === "" || item.length > 80)) return "Each palette item must be 1–80 characters."
  if (plan.instruments.length > 16) return "Keep the palette to 16 items or fewer."
  if (plan.vocalDirection.trim() === "") return "Add an arrangement or vocal direction."
  if (plan.vocalDirection.length > 500) return "Keep the direction under 500 characters."
  if (plan.lyricsIntent.trim() === "") return "Add a creative or lyrics intent."
  if (plan.lyricsIntent.length > 1000) return "Keep the intent under 1,000 characters."
  return null
}

function isAudioReference(file: File): boolean {
  return file.type.startsWith("audio/") || /\.(?:mp3|wav|m4a|flac|aac|ogg)$/iu.test(file.name)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
