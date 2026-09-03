"use client"

import { ArrowRight, Check, Pencil, RotateCcw, Save, Sparkles, X } from "lucide-react"
import { useId, useState } from "react"
import type { FormEvent } from "react"
import {
  buildStudioLyricsPlan,
  buildStudioLyricsPreview,
  defaultStudioLyrics,
  replaceStudioLyricsScope,
  studioLyricsDirectionLabel,
  studioLyricsScopeLabel,
  type StudioLyricsDirection,
  type StudioLyricsPlan,
  type StudioLyricsScope,
} from "../studio-lyrics"
import styles from "./studio-lyrics-editor.module.css"

type StudioLyricsEditorProps = {
  versionRef: string
}

const directions: readonly StudioLyricsDirection[] = ["rewrite", "continue", "rhyme", "restructure"]
const scopes: readonly StudioLyricsScope[] = ["verse", "chorus", "whole_lyrics"]

const directionPlaceholders: Record<StudioLyricsDirection, string> = {
  rewrite: "Make the image more vivid while keeping the same cadence…",
  continue: "Carry this thought into the next lyrical moment…",
  rhyme: "Describe the rhyme, sound, or phrase you want to land…",
  restructure: "Describe how the lyrical arc should unfold…",
}

export function StudioLyricsEditor({ versionRef }: StudioLyricsEditorProps) {
  const promptId = useId()
  const storageKey = `mori.lyrics.${versionRef}`
  const [lyrics, setLyrics] = useState(() => readStoredLyrics(storageKey) ?? defaultStudioLyrics)
  const [saved, setSaved] = useState(true)
  const [direction, setDirection] = useState<StudioLyricsDirection>("rewrite")
  const [scope, setScope] = useState<StudioLyricsScope>("verse")
  const [instruction, setInstruction] = useState("")
  const [plan, setPlan] = useState<StudioLyricsPlan | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [undoDraft, setUndoDraft] = useState<string | null>(null)
  const wordCount = lyrics.trim() === "" ? 0 : lyrics.trim().split(/\s+/u).length

  const editLyrics = (nextLyrics: string) => {
    setLyrics(nextLyrics)
    setSaved(false)
    setPlan(null)
    setSuggestion(null)
  }

  const chooseDirection = (nextDirection: StudioLyricsDirection) => {
    setDirection(nextDirection)
    setPlan(null)
    setSuggestion(null)
  }

  const chooseScope = (nextScope: StudioLyricsScope) => {
    setScope(nextScope)
    setPlan(null)
    setSuggestion(null)
  }

  const reviewDirection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (instruction.trim() === "") return
    const nextPlan = buildStudioLyricsPlan(direction, scope, instruction, lyrics)
    setInstruction(nextPlan.instruction)
    setPlan(nextPlan)
    setSuggestion(null)
  }

  const createSuggestion = () => {
    if (plan === null) return
    setSuggestion(buildStudioLyricsPreview(plan))
  }

  const applySuggestion = () => {
    if (plan === null || suggestion === null || suggestion.trim() === "") return
    setUndoDraft(lyrics)
    setLyrics(replaceStudioLyricsScope(lyrics, plan.scope, suggestion))
    setSaved(false)
    setPlan(null)
    setSuggestion(null)
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

          {plan === null ? <>
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
                onChange={(event) => { setInstruction(event.target.value); setSuggestion(null) }}
              />
              <button type="submit" disabled={instruction.trim() === ""}>Review direction <ArrowRight size={13} /></button>
            </form>
          </> : null}

          {plan !== null && suggestion === null ? (
            <section className={styles.directionPlan} aria-label="Lyric direction plan" aria-live="polite">
              <header><span>Direction plan</span><strong>{studioLyricsDirectionLabel(plan.direction)}</strong></header>
              <p>{plan.instruction}</p>
              <div className={styles.planFacts}>
                <span><strong>Scope</strong>{studioLyricsScopeLabel(plan.scope)}</span>
                <span><strong>Keep</strong>Meaning · cadence</span>
              </div>
              <footer>
                <span><Check size={12} /> Original draft stays untouched.</span>
                <div>
                  <button type="button" onClick={() => { setPlan(null); window.requestAnimationFrame(() => document.getElementById(promptId)?.focus()) }}><Pencil size={12} /> Edit</button>
                  <button className={styles.primaryAction} type="button" onClick={createSuggestion}>Create suggestion <Sparkles size={12} /></button>
                </div>
              </footer>
            </section>
          ) : null}

          {plan !== null && suggestion !== null ? (
            <section className={styles.suggestion} aria-label="Lyric suggestion" aria-live="polite">
              <header><div><span>Mori suggestion</span><strong>{studioLyricsScopeLabel(plan.scope)}</strong></div><span>Editable</span></header>
              <textarea aria-label="Suggested lyrics" value={suggestion} rows={5} onChange={(event) => setSuggestion(event.target.value)} />
              <footer>
                <button type="button" onClick={() => setSuggestion(null)}><X size={12} /> Dismiss</button>
                <button className={styles.primaryAction} type="button" disabled={suggestion.trim() === ""} onClick={applySuggestion}>Apply to draft <ArrowRight size={12} /></button>
              </footer>
            </section>
          ) : null}
        </section>
      </div>
    </section>
  )
}

function readStoredLyrics(storageKey: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}
