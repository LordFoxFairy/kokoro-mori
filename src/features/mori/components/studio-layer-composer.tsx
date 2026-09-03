"use client"

import { ArrowRight, Check, Mic2, Music2, Pencil, RotateCcw, Sparkles, Square } from "lucide-react"
import { useId, useState, type FormEvent } from "react"
import { previewVoiceProfiles } from "../creative-assets"
import { isActiveStudioChangeStatus } from "../studio-change"
import { buildStudioLayerPlan, isStudioLayerPlan, type StudioLayerMode, type StudioLayerPlan } from "../studio-layers"
import type { StudioAiRunState } from "./studio-ai-composer"
import styles from "./studio-layer-composer.module.css"

type StudioLayerComposerProps = {
  mode: StudioLayerMode
  durationSeconds: number
  run: StudioAiRunState
  onGenerate: (plan: StudioLayerPlan) => void
  onCancel: () => void
  onReset: () => void
  onReviewTakes: () => void
}

export function StudioLayerComposer({ mode, durationSeconds, run, onGenerate, onCancel, onReset, onReviewTakes }: StudioLayerComposerProps) {
  const lyricsId = useId()
  const directionId = useId()
  const voiceId = useId()
  const runPlan = isStudioLayerPlan(run.plan) && run.plan.layerKind === mode ? run.plan : null
  const [lyrics, setLyrics] = useState(() => runPlan?.draft.lyrics ?? "")
  const [instruction, setInstruction] = useState(() => runPlan?.instruction ?? "")
  const [voiceRef, setVoiceRef] = useState(() => runPlan?.draft.voiceRef ?? "")
  const [reviewedPlan, setReviewedPlan] = useState<StudioLayerPlan | null>(null)
  const busy = isActiveStudioChangeStatus(run.status)
  const visiblePlan = run.status === "idle" ? reviewedPlan : runPlan
  const canReview = instruction.trim() !== "" && (mode === "instrumental" || lyrics.trim() !== "") && !busy

  const updateDraft = (update: () => void) => {
    if (busy) return
    if (run.status !== "idle") onReset()
    update()
    setReviewedPlan(null)
  }

  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canReview) return
    setReviewedPlan(buildStudioLayerPlan(mode, {
      instruction,
      lyrics,
      voiceRef,
      durationSeconds,
    }))
  }

  const editPlan = () => {
    if (busy) return
    if (run.status !== "idle") onReset()
    setReviewedPlan(null)
    window.requestAnimationFrame(() => document.getElementById(mode === "vocals" ? lyricsId : directionId)?.focus())
  }

  const status = layerRunStatus(run, runPlan !== null)
  const title = mode === "vocals" ? "Layer a vocal across this version." : "Build music around this version."

  return (
    <section className={styles.composer} aria-label={`${mode === "vocals" ? "Add vocals" : "Add instrumental"} workflow`}>
      <header className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true">{mode === "vocals" ? <Mic2 /> : <Music2 />}</span>
        <div>
          <span>Mori layer</span>
          <h4>{title}</h4>
          <p>{mode === "vocals"
            ? "Write the words, choose an optional voice identity, then review how they sit over the current music."
            : "Describe the arrangement Mori should place around the existing vocal or musical idea."}</p>
        </div>
      </header>

      <form className={styles.form} onSubmit={review}>
        {mode === "vocals" ? (
          <label className={styles.field} htmlFor={lyricsId}>
            <span>Lyrics</span>
            <textarea
              id={lyricsId}
              aria-label="Lyrics for vocal layer"
              value={lyrics}
              rows={5}
              disabled={busy}
              placeholder="Write or paste the lyrics for this vocal…"
              onChange={(event) => updateDraft(() => setLyrics(event.target.value))}
            />
          </label>
        ) : null}

        <div className={mode === "vocals" ? styles.directionGrid : undefined}>
          <label className={styles.field} htmlFor={directionId}>
            <span>{mode === "vocals" ? "Vocal direction" : "Instrumental direction"}</span>
            <textarea
              id={directionId}
              aria-label={mode === "vocals" ? "Vocal direction" : "Instrumental direction"}
              value={instruction}
              rows={mode === "vocals" ? 3 : 5}
              disabled={busy}
              placeholder={mode === "vocals"
                ? "Close, unhurried lead with a gentle lift in the chorus…"
                : "Warm piano, brushed drums, and restrained strings that leave space for the lead…"}
              onChange={(event) => updateDraft(() => setInstruction(event.target.value))}
            />
          </label>

          {mode === "vocals" ? (
            <label className={styles.field} htmlFor={voiceId}>
              <span>Voice profile <small>Optional</small></span>
              <select id={voiceId} aria-label="Voice profile" value={voiceRef} disabled={busy} onChange={(event) => updateDraft(() => setVoiceRef(event.target.value))}>
                <option value="">Mori voice</option>
                {previewVoiceProfiles.map((profile) => <option value={profile.ref} key={profile.ref}>{profile.name} · {profile.description}</option>)}
              </select>
              <small className={styles.fieldHint}>Voice identity stays separate from this take&apos;s direction.</small>
            </label>
          ) : null}
        </div>

        <div className={styles.context} aria-label="Layer context">
          <span><strong>Source</strong>Current version</span>
          <span><strong>Scope</strong>Whole song</span>
          <span><strong>Output</strong>2 alternatives · Take lanes</span>
        </div>

        <button className={styles.reviewButton} type="submit" disabled={!canReview}>
          Review {mode === "vocals" ? "vocal" : "instrumental"} layer <ArrowRight />
        </button>
      </form>

      {visiblePlan !== null ? (
        <section className={styles.plan} aria-label="Studio layer plan" aria-live="polite" aria-busy={busy}>
          <header className={styles.planHeader}>
            <div><span>Layer plan</span><h4>{visiblePlan.layerKind === "vocals" ? "Add vocals" : "Add instrumental"}</h4></div>
            <span className={status.className}>{status.label}</span>
          </header>
          <p className={styles.instruction}>{visiblePlan.instruction}</p>
          <div className={styles.planFacts}>
            <span><strong>Scope</strong>{visiblePlan.scopeLabel}</span>
            <span><strong>Keep</strong>{preserveLabel(visiblePlan)}</span>
            <span><strong>Result</strong>2 alternatives · Take lanes</span>
          </div>
          {visiblePlan.layerKind === "vocals" ? (
            <div className={styles.vocalFacts}>
              <span><strong>Lyrics</strong>{lineCountLabel(visiblePlan.draft.lyrics ?? "")}</span>
              <span><strong>Voice</strong>{voiceLabel(visiblePlan.draft.voiceRef)}</span>
            </div>
          ) : null}
          {busy ? (
            <div className={styles.progressRow}>
              <div role="progressbar" aria-label="Studio layer progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress}>
                <span style={{ width: `${Math.max(0, Math.min(100, run.progress))}%` }} />
              </div>
              <span>{run.progress}%</span>
            </div>
          ) : null}
          {run.message !== null ? <p className={styles.message}>{run.message}</p> : null}
          <footer className={styles.planFooter}>
            <span><Check /> Current version stays untouched.</span>
            <div>
              {busy ? (
                <button className={styles.cancelButton} type="button" onClick={onCancel}><Square fill="currentColor" /> Cancel layer</button>
              ) : <>
                <button type="button" onClick={editPlan}><Pencil /> Edit request</button>
                {run.status === "succeeded" && run.resultCount > 0 ? (
                  <button className={styles.primaryButton} type="button" onClick={onReviewTakes}>Review takes in Arrangement <ArrowRight /></button>
                ) : run.status === "failed" || run.status === "cancelled" || run.status === "expired" || (run.status === "succeeded" && run.resultCount === 0) ? (
                  <button className={styles.primaryButton} type="button" onClick={() => onGenerate(visiblePlan)}><RotateCcw /> Retry layer</button>
                ) : (
                  <button className={styles.primaryButton} type="button" onClick={() => onGenerate(visiblePlan)}>Generate 2 takes <Sparkles /></button>
                )}
              </>}
            </div>
          </footer>
        </section>
      ) : null}
    </section>
  )
}

function preserveLabel(plan: StudioLayerPlan): string {
  const labels = {
    melody: "Melody",
    lyrics: "Lyrics",
    vocal_identity: "Voice",
    tempo: "Tempo",
    structure: "Structure",
  }
  return plan.preserve.map((item) => labels[item]).join(" · ")
}

function lineCountLabel(lyrics: string): string {
  const count = lyrics.split("\n").filter((line) => line.trim() !== "").length
  return `${count} ${count === 1 ? "line" : "lines"}`
}

function voiceLabel(voiceRef: string | undefined): string {
  if (voiceRef === undefined || voiceRef === "") return "Mori voice"
  return previewVoiceProfiles.find((profile) => profile.ref === voiceRef)?.name ?? "Selected voice"
}

function layerRunStatus(run: StudioAiRunState, matchesLayer: boolean): { label: string; className: string } {
  if (!matchesLayer && run.status !== "idle") return { label: "Another change is active", className: styles.planStopped }
  switch (run.status) {
    case "idle": return { label: "Review before rendering", className: styles.planDraft }
    case "preparing": return { label: "Preparing layer", className: styles.planRunning }
    case "queued": return { label: "Queued", className: styles.planRunning }
    case "generating": return { label: "Building layer", className: styles.planRunning }
    case "post_processing": return { label: "Finishing takes", className: styles.planRunning }
    case "succeeded": return run.resultCount > 0
      ? { label: `${run.resultCount} ${run.resultCount === 1 ? "take" : "takes"} ready`, className: styles.planReady }
      : { label: "No takes returned", className: styles.planError }
    case "failed": return { label: "Layer failed", className: styles.planError }
    case "cancelled": return { label: "Layer cancelled", className: styles.planStopped }
    case "expired": return { label: "Layer expired", className: styles.planStopped }
  }
}
