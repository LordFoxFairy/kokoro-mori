"use client"

import { ArrowRight, Check, LoaderCircle, Pencil, RotateCcw, Save, Sparkles, X } from "lucide-react"
import { useId, useState } from "react"
import type { FormEvent } from "react"
import type { LyricsRevisionStatus, MoriLyricsSuggestion } from "@/lib/mori-api"
import {
  buildStudioLyricsPlan,
  defaultStudioLyrics,
  isActiveLyricsRevisionStatus,
  replaceStudioLyricsScope,
  studioLyricsDirectionLabel,
  studioLyricsScopeLabel,
  type StudioLyricsDirection,
  type StudioLyricsPlan,
  type StudioLyricsScope,
} from "../studio-lyrics"
import styles from "./studio-lyrics-editor.module.css"

export type StudioLyricsRunState = {
  status: "idle" | "preparing" | LyricsRevisionStatus
  progress: number
  plan: StudioLyricsPlan | null
  suggestions: MoriLyricsSuggestion[]
  sourceDigest: string | null
  message: string | null
}

type StudioLyricsEditorProps = {
  versionRef: string
  run: StudioLyricsRunState
  onGenerate: (plan: StudioLyricsPlan) => void
  onCancel: () => void
  onReset: () => void
}

const directions: readonly StudioLyricsDirection[] = ["rewrite", "continue", "rhyme", "restructure"]
const scopes: readonly StudioLyricsScope[] = ["verse", "chorus", "whole_lyrics"]

const directionPlaceholders: Record<StudioLyricsDirection, string> = {
  rewrite: "Make the image more vivid while keeping the same cadence…",
  continue: "Carry this thought into the next lyrical moment…",
  rhyme: "Describe the rhyme, sound, or phrase you want to land…",
  restructure: "Describe how the lyrical arc should unfold…",
}

export function StudioLyricsEditor({ versionRef, run, onGenerate, onCancel, onReset }: StudioLyricsEditorProps) {
  const promptId = useId()
  const storageKey = `mori.lyrics.${versionRef}`
  const [lyrics, setLyrics] = useState(() => readStoredLyrics(storageKey) ?? defaultStudioLyrics)
  const [saved, setSaved] = useState(true)
  const [direction, setDirection] = useState<StudioLyricsDirection>(() => run.plan?.direction ?? "rewrite")
  const [scope, setScope] = useState<StudioLyricsScope>(() => run.plan?.scope ?? "verse")
  const [instruction, setInstruction] = useState(() => run.plan?.instruction ?? "")
  const [reviewedPlan, setReviewedPlan] = useState<StudioLyricsPlan | null>(() => run.status === "idle" ? null : run.plan)
  const [undoDraft, setUndoDraft] = useState<string | null>(null)
  const wordCount = lyrics.trim() === "" ? 0 : lyrics.trim().split(/\s+/u).length
  const visiblePlan = run.status === "idle" ? reviewedPlan : run.plan
  const draftChangedSinceReview = visiblePlan !== null && lyrics.trim() !== visiblePlan.lyricsContext

  const editLyrics = (nextLyrics: string) => {
    setLyrics(nextLyrics)
    setSaved(false)
    if (run.status === "idle") setReviewedPlan(null)
  }

  const chooseDirection = (nextDirection: StudioLyricsDirection) => {
    setDirection(nextDirection)
    setReviewedPlan(null)
  }

  const chooseScope = (nextScope: StudioLyricsScope) => {
    setScope(nextScope)
    setReviewedPlan(null)
  }

  const reviewDirection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (instruction.trim() === "") return
    const nextPlan = buildStudioLyricsPlan(direction, scope, instruction, lyrics)
    setInstruction(nextPlan.instruction)
    setReviewedPlan(nextPlan)
  }

  const editPlan = () => {
    if (visiblePlan === null || isActiveLyricsRevisionStatus(run.status)) return
    setDirection(visiblePlan.direction)
    setScope(visiblePlan.scope)
    setInstruction(visiblePlan.instruction)
    setReviewedPlan(null)
    onReset()
    window.requestAnimationFrame(() => document.getElementById(promptId)?.focus())
  }

  const startOver = () => {
    if (isActiveLyricsRevisionStatus(run.status)) return
    setReviewedPlan(null)
    onReset()
  }

  const applySuggestion = (suggestionText: string) => {
    if (visiblePlan === null || suggestionText.trim() === "" || draftChangedSinceReview) return
    setUndoDraft(lyrics)
    setLyrics(replaceStudioLyricsScope(lyrics, visiblePlan, suggestionText))
    setSaved(false)
    setReviewedPlan(null)
    onReset()
  }

  const undoAiEdit = () => {
    if (undoDraft === null) return
    setLyrics(undoDraft)
    setUndoDraft(null)
    setSaved(false)
  }

  const saveDraft = () => {
    try {
      window.localStorage.setItem(storageKey, lyrics)
      setSaved(true)
      setUndoDraft(null)
    } catch {
      setSaved(false)
    }
  }

  return (
    <section className={styles.lyricsEditor} aria-label="Lyrics editor">
      <header className={styles.lyricsHeader}>
        <div><span>Words stay close to the take</span><h3>Lyrics draft</h3></div>
        <span className={saved ? styles.savedBadge : styles.unsavedBadge}>{saved ? "Saved locally" : "Unsaved changes"}</span>
      </header>

      <div className={styles.lyricsWorkspace}>
        <section className={styles.draftPanel} aria-label="Current lyric draft">
          <div className={styles.draftMeta}><span>Draft 01</span><span>{wordCount} words</span></div>
          <textarea
            className={styles.draftArea}
            aria-label="Lyrics draft"
            value={lyrics}
            onChange={(event) => editLyrics(event.target.value)}
          />
          <footer className={styles.draftFooter}>
            <span>Changes stay local until saved.</span>
            <div>
              {undoDraft !== null ? <button className={styles.textButton} type="button" onClick={undoAiEdit}><RotateCcw size={13} /> Undo AI edit</button> : null}
              <button className={styles.saveButton} type="button" disabled={saved} onClick={saveDraft}>{saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save draft</>}</button>
            </div>
          </footer>
        </section>

        <section className={styles.lyricPartner} aria-label="Mori lyric partner">
          <header className={styles.partnerHeader}>
            <div className={styles.partnerIdentity}><span aria-hidden="true"><Sparkles size={14} /></span><div><small>Mori AI</small><strong>Write with intention</strong></div></div>
            <span className={styles.draftOnly}>Draft only</span>
          </header>

          {visiblePlan === null ? <>
            <div className={styles.directionGrid} role="group" aria-label="Lyric direction">
              {directions.map((item) => <button type="button" aria-pressed={direction === item} key={item} onClick={() => chooseDirection(item)}>{studioLyricsDirectionLabel(item)}</button>)}
            </div>

            <div className={styles.scopeGroup} role="group" aria-label="Lyric scope">
              <span>Work on</span>
              <div>{scopes.map((item) => <button type="button" aria-pressed={scope === item} key={item} onClick={() => chooseScope(item)}>{studioLyricsScopeLabel(item)}</button>)}</div>
            </div>

            <form className={styles.directionForm} onSubmit={reviewDirection}>
              <label htmlFor={promptId}>Describe the lyric direction</label>
              <textarea
                id={promptId}
                value={instruction}
                rows={3}
                placeholder={directionPlaceholders[direction]}
                onChange={(event) => setInstruction(event.target.value)}
              />
              <button type="submit" disabled={instruction.trim() === ""}>Review direction <ArrowRight size={13} /></button>
            </form>
          </> : null}

          {visiblePlan !== null && run.suggestions.length === 0 ? (
            <LyricsDirectionPlan
              plan={visiblePlan}
              run={run}
              onEdit={editPlan}
              onGenerate={() => onGenerate(visiblePlan)}
              onCancel={onCancel}
            />
          ) : null}

          {visiblePlan !== null && run.suggestions.length > 0 ? (
            <LyricsSuggestions
              key={run.sourceDigest ?? run.suggestions.map((suggestion) => suggestion.suggestion_ref).join("|")}
              plan={visiblePlan}
              run={run}
              draftChangedSinceReview={draftChangedSinceReview}
              onApply={applySuggestion}
              onStartOver={startOver}
            />
          ) : null}
        </section>
      </div>
    </section>
  )
}

type LyricsSuggestionsProps = {
  plan: StudioLyricsPlan
  run: StudioLyricsRunState
  draftChangedSinceReview: boolean
  onApply: (suggestionText: string) => void
  onStartOver: () => void
}

function LyricsSuggestions({ plan, run, draftChangedSinceReview, onApply, onStartOver }: LyricsSuggestionsProps) {
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>(() => suggestionDraftMap(run.suggestions))
  const [selectedSuggestionRef, setSelectedSuggestionRef] = useState<string | null>(() => run.suggestions[0]?.suggestion_ref ?? null)
  const selectedSuggestion = run.suggestions.find((suggestion) => suggestion.suggestion_ref === selectedSuggestionRef) ?? run.suggestions[0] ?? null
  const selectedSuggestionText = selectedSuggestion === null ? "" : suggestionDrafts[selectedSuggestion.suggestion_ref] ?? selectedSuggestion.text

  return (
    <section className={styles.suggestion} aria-label="Lyric suggestions" aria-live="polite">
      <header>
        <div><span>Mori suggestions</span><strong>{studioLyricsScopeLabel(plan.scope)}</strong></div>
        <span>{run.suggestions.length} options · Editable</span>
      </header>
      <div className={styles.suggestionTabs} role="group" aria-label="Lyric suggestion choices">
        {run.suggestions.map((suggestion, index) => (
          <button
            type="button"
            aria-pressed={suggestion.suggestion_ref === selectedSuggestion?.suggestion_ref}
            key={suggestion.suggestion_ref}
            onClick={() => setSelectedSuggestionRef(suggestion.suggestion_ref)}
          >
            Suggestion {index + 1}
          </button>
        ))}
      </div>
      <textarea
        aria-label="Suggested lyrics"
        value={selectedSuggestionText}
        rows={5}
        onChange={(event) => {
          if (selectedSuggestion === null) return
          setSuggestionDrafts((current) => ({ ...current, [selectedSuggestion.suggestion_ref]: event.target.value }))
        }}
      />
      <p className={styles.sourceNote}>Based on the reviewed {studioLyricsScopeLabel(plan.scope).toLowerCase()} · source locked</p>
      {draftChangedSinceReview ? <p className={styles.staleWarning}>The draft changed after review. Start again to keep the edit aligned.</p> : null}
      {run.message !== null ? <p className={styles.runMessage}>{run.message}</p> : null}
      <footer>
        <button type="button" onClick={onStartOver}><X size={12} /> Start over</button>
        <button className={styles.primaryAction} type="button" disabled={selectedSuggestionText.trim() === "" || draftChangedSinceReview} onClick={() => onApply(selectedSuggestionText)}>Apply to draft <ArrowRight size={12} /></button>
      </footer>
    </section>
  )
}

type LyricsDirectionPlanProps = {
  plan: StudioLyricsPlan
  run: StudioLyricsRunState
  onEdit: () => void
  onGenerate: () => void
  onCancel: () => void
}

function LyricsDirectionPlan({ plan, run, onEdit, onGenerate, onCancel }: LyricsDirectionPlanProps) {
  const active = isActiveLyricsRevisionStatus(run.status)
  const canCancel = run.status === "queued" || run.status === "generating"
  const canRetry = run.status === "failed" || run.status === "cancelled" || run.status === "expired" || run.status === "succeeded"
  const stateClassName = run.status === "failed"
    ? styles.planError
    : run.status === "cancelled" || run.status === "expired"
      ? styles.planStopped
      : run.status === "succeeded"
        ? styles.planReady
        : active
          ? styles.planRunning
          : styles.planDraft

  return (
    <section className={`${styles.directionPlan} ${stateClassName}`} aria-label="Lyric direction plan" aria-live="polite">
      <header>
        <div><span>Direction plan</span><strong>{studioLyricsDirectionLabel(plan.direction)}</strong></div>
        <span>{lyricsRevisionStatusLabel(run.status)}</span>
      </header>
      <p>{plan.instruction}</p>
      <div className={styles.planFacts}>
        <span><strong>Scope</strong>{studioLyricsScopeLabel(plan.scope)}</span>
        <span><strong>Keep</strong>{plan.constraints.map(lyricsConstraintLabel).join(" · ")}</span>
      </div>
      {active ? <div className={styles.revisionProgressRow}>
        <div><span>{run.status === "preparing" ? "Preparing request" : "Writing alternatives"}</span><strong>{Math.round(run.progress)}%</strong></div>
        <progress className={styles.revisionProgress} aria-label="Lyrics revision progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress} max={100} value={run.progress} />
      </div> : null}
      {run.message !== null ? <p className={styles.runMessage}>{run.message}</p> : null}
      {run.status === "succeeded" ? <p className={styles.runMessage}>Mori finished without a usable lyric suggestion. Your direction is ready to retry.</p> : null}
      <footer>
        <span><Check size={12} /> Original draft stays untouched.</span>
        <div>
          {!active ? <button type="button" onClick={onEdit}><Pencil size={12} /> Edit</button> : null}
          {canCancel ? <button className={styles.cancelAction} type="button" onClick={onCancel}><X size={12} /> Cancel revision</button> : null}
          {run.status === "preparing" ? <button type="button" disabled><LoaderCircle size={12} /> Preparing</button> : null}
          {run.status === "idle" ? <button className={styles.primaryAction} type="button" onClick={onGenerate}>Create {plan.outputCount} suggestions <Sparkles size={12} /></button> : null}
          {canRetry ? <button className={styles.primaryAction} type="button" onClick={onGenerate}>Retry {plan.outputCount} suggestions <RotateCcw size={12} /></button> : null}
        </div>
      </footer>
    </section>
  )
}

function lyricsRevisionStatusLabel(status: StudioLyricsRunState["status"]): string {
  switch (status) {
    case "idle": return "Ready to create"
    case "preparing": return "Preparing"
    case "queued": return "Queued"
    case "generating": return "Writing"
    case "succeeded": return "Ready"
    case "failed": return "Needs retry"
    case "cancelled": return "Cancelled"
    case "expired": return "Expired"
  }
}

function lyricsConstraintLabel(constraint: StudioLyricsPlan["constraints"][number]): string {
  switch (constraint) {
    case "meaning": return "Meaning"
    case "cadence": return "Cadence"
    case "rhyme_scheme": return "Rhyme"
    case "section_length": return "Section length"
  }
}

function suggestionDraftMap(suggestions: MoriLyricsSuggestion[]): Record<string, string> {
  return Object.fromEntries(suggestions.map((suggestion) => [suggestion.suggestion_ref, suggestion.text]))
}

function readStoredLyrics(storageKey: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}
