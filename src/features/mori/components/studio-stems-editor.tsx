"use client"

import { ArrowRight, Check, FileMusic, Layers3, Mic2, Music2, RotateCcw, Scissors, Sparkles, Volume2, VolumeX, X } from "lucide-react"
import { useState } from "react"
import type { MoriStem, StemSeparationStatus } from "@/lib/mori-api"
import { isActiveStudioChangeStatus, type StudioChangePlan } from "../studio-change"
import { isStudioLayerPlan } from "../studio-layers"
import {
  buildStudioStemSeparationPlan,
  isActiveStemSeparationStatus,
  studioStemSeparationActionLabel,
  studioStemSeparationModeLabel,
  studioStemSeparationOutputLabel,
  type StudioStemSeparationMode,
  type StudioStemSeparationPlan,
} from "../studio-stems"
import { Waveform } from "./waveform"
import { StudioLayerComposer } from "./studio-layer-composer"
import type { StudioAiRunState } from "./studio-ai-composer"
import styles from "./studio-stems-editor.module.css"

export type StudioStemSeparationRunState = {
  status: "idle" | "preparing" | StemSeparationStatus
  sourceVersionRef: string | null
  progress: number
  plan: StudioStemSeparationPlan | null
  stems: MoriStem[]
  midiAssetRef: string | null
  sourceAudioDigest: string | null
  message: string | null
}

type StudioStemsEditorProps = {
  durationSeconds: number
  run: StudioStemSeparationRunState
  layerRun: StudioAiRunState
  onSeparate: (plan: StudioStemSeparationPlan) => void
  onCancel: () => void
  onReset: () => void
  onGenerateLayer: (plan: StudioChangePlan) => void
  onCancelLayer: () => void
  onResetLayer: () => void
  onReviewTakes: () => void
}

const modes: readonly StudioStemSeparationMode[] = ["vocals_instrumental", "auto_stems"]
type StemsWorkflow = "separate" | "vocals" | "instrumental"

const workflows = [
  { id: "separate", label: "Separate mix", Icon: Scissors },
  { id: "vocals", label: "Add vocals", Icon: Mic2 },
  { id: "instrumental", label: "Add instrumental", Icon: Music2 },
] satisfies readonly { id: StemsWorkflow; label: string; Icon: typeof Scissors }[]

export function StudioStemsEditor({ durationSeconds, run, layerRun, onSeparate, onCancel, onReset, onGenerateLayer, onCancelLayer, onResetLayer, onReviewTakes }: StudioStemsEditorProps) {
  const [workflow, setWorkflow] = useState<StemsWorkflow>(() => isStudioLayerPlan(layerRun.plan) ? layerRun.plan.layerKind : "separate")
  const [mode, setMode] = useState<StudioStemSeparationMode>(() => run.plan?.mode ?? "vocals_instrumental")
  const [includeMidi, setIncludeMidi] = useState(() => run.plan?.includeMidi ?? false)
  const [reviewedPlan, setReviewedPlan] = useState<StudioStemSeparationPlan | null>(() => run.status === "idle" ? null : run.plan)
  const [mutedStems, setMutedStems] = useState<string[]>([])
  const [soloStemRef, setSoloStemRef] = useState<string | null>(null)
  const visiblePlan = run.status === "idle" ? reviewedPlan : run.plan
  const ready = run.status === "succeeded" && run.stems.length > 0
  const workflowLocked = isActiveStemSeparationStatus(run.status) || isActiveStudioChangeStatus(layerRun.status)

  const review = () => setReviewedPlan(buildStudioStemSeparationPlan(mode, includeMidi))

  const editPlan = () => {
    if (visiblePlan === null || isActiveStemSeparationStatus(run.status)) return
    setMode(visiblePlan.mode)
    setIncludeMidi(visiblePlan.includeMidi)
    setReviewedPlan(null)
    onReset()
  }

  const startOver = () => {
    if (isActiveStemSeparationStatus(run.status)) return
    setReviewedPlan(null)
    setMutedStems([])
    setSoloStemRef(null)
    onReset()
  }

  const toggleMute = (stemRef: string) => {
    setMutedStems((current) => current.includes(stemRef) ? current.filter((item) => item !== stemRef) : [...current, stemRef])
  }

  return (
    <section className={styles.stemsEditor} aria-label="Stems editor">
      <header className={styles.surfaceHeader}>
        <div><span>Build or separate this version</span><h3>Voice & stems</h3></div>
        <span className={ready ? styles.readyBadge : styles.setupBadge}>{ready ? `${run.stems.length} stems ready` : "Non-destructive"}</span>
      </header>

      <div className={styles.workflowTabs} role="group" aria-label="Stems workflow">
        {workflows.map(({ id, label, Icon }) => (
          <button type="button" aria-pressed={workflow === id} disabled={workflowLocked && workflow !== id} key={id} onClick={() => setWorkflow(id)}>
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {workflow === "separate" && visiblePlan === null ? (
        <section className={styles.setupPanel} aria-label="Stem separation setup">
          <div className={styles.setupIntro}>
            <span className={styles.setupIcon} aria-hidden="true"><Scissors size={16} /></span>
            <div><span>Mori separation</span><h4>Choose the separation depth.</h4><p>The current version remains intact while Mori creates reusable stem assets.</p></div>
          </div>
          <div className={styles.modeGrid} role="group" aria-label="Separation mode">
            {modes.map((item) => (
              <button type="button" aria-label={studioStemSeparationModeLabel(item)} aria-pressed={mode === item} key={item} onClick={() => setMode(item)}>
                <span aria-hidden="true">{item === "vocals_instrumental" ? <Scissors size={15} /> : <Layers3 size={15} />}</span>
                <strong>{studioStemSeparationModeLabel(item)}</strong>
                <small>{item === "vocals_instrumental" ? "2 clean parts · faster" : "Up to 12 detected parts · detailed edit"}</small>
              </button>
            ))}
          </div>
          <label className={styles.midiOption}>
            <input type="checkbox" aria-label="Export MIDI transcription" checked={includeMidi} onChange={(event) => setIncludeMidi(event.target.checked)} />
            <span aria-hidden="true" />
            <div><strong>Export MIDI transcription</strong><small>Add a note-level draft alongside the audio stems.</small></div>
            <FileMusic size={15} aria-hidden="true" />
          </label>
          <button className={styles.reviewButton} type="button" onClick={review}>Review separation <ArrowRight size={13} /></button>
        </section>
      ) : null}

      {workflow === "separate" && visiblePlan !== null && !ready ? (
        <StemSeparationPlan
          plan={visiblePlan}
          run={run}
          onEdit={editPlan}
          onSeparate={() => onSeparate(visiblePlan)}
          onCancel={onCancel}
        />
      ) : null}

      {workflow === "separate" && visiblePlan !== null && ready ? (
        <section className={styles.results} aria-label="Stem tracks">
          <header className={styles.resultsHeader}>
            <div><span>Separated from this version</span><h4>Stem tracks</h4></div>
            <button type="button" onClick={startOver}><RotateCcw size={12} /> New separation</button>
          </header>
          <div className={styles.stemTrackList}>
            {run.stems.map((stem, index) => {
              const muted = mutedStems.includes(stem.stem_ref)
              const solo = soloStemRef === stem.stem_ref
              const suppressedBySolo = soloStemRef !== null && !solo
              return (
                <article className={`${styles.stemTrack} ${muted || suppressedBySolo ? styles.stemTrackMuted : ""}`} aria-label={`${stem.label} stem`} key={stem.stem_ref}>
                  <div className={styles.stemIdentity}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{stem.label}</strong><small>{stemDetail(stem)}</small></div></div>
                  <div className={styles.stemWave}><Waveform seed={stemSeed(stem, index)} compact progress={muted || suppressedBySolo ? 0.08 : solo ? 0.92 : 0.56} /></div>
                  <span className={styles.duration}>{formatDuration(stem.duration_seconds)}</span>
                  <div className={styles.stemActions}>
                    <button type="button" aria-pressed={muted} aria-label={`${muted ? "Unmute" : "Mute"} ${stem.label}`} onClick={() => toggleMute(stem.stem_ref)}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
                    <button className={solo ? styles.soloActive : ""} type="button" aria-pressed={solo} aria-label={`${solo ? "Unsolo" : "Solo"} ${stem.label}`} onClick={() => setSoloStemRef(solo ? null : stem.stem_ref)}>Solo</button>
                  </div>
                </article>
              )
            })}
          </div>
          {run.midiAssetRef !== null ? <div className={styles.midiReady}><FileMusic size={15} /><div><strong>MIDI transcription ready</strong><span>Stored as a version-bound asset.</span></div></div> : null}
          <p className={styles.resultNote}>Mix controls are staged locally until playable stem audio is connected.</p>
        </section>
      ) : null}

      <div hidden={workflow !== "vocals"}>
        <StudioLayerComposer
          mode="vocals"
          durationSeconds={durationSeconds}
          run={layerRun}
          onGenerate={onGenerateLayer}
          onCancel={onCancelLayer}
          onReset={onResetLayer}
          onReviewTakes={onReviewTakes}
        />
      </div>
      <div hidden={workflow !== "instrumental"}>
        <StudioLayerComposer
          mode="instrumental"
          durationSeconds={durationSeconds}
          run={layerRun}
          onGenerate={onGenerateLayer}
          onCancel={onCancelLayer}
          onReset={onResetLayer}
          onReviewTakes={onReviewTakes}
        />
      </div>
    </section>
  )
}

type StemSeparationPlanProps = {
  plan: StudioStemSeparationPlan
  run: StudioStemSeparationRunState
  onEdit: () => void
  onSeparate: () => void
  onCancel: () => void
}

function StemSeparationPlan({ plan, run, onEdit, onSeparate, onCancel }: StemSeparationPlanProps) {
  const active = isActiveStemSeparationStatus(run.status)
  const canCancel = run.status === "queued" || run.status === "separating"
  const canRetry = run.status === "failed" || run.status === "cancelled" || run.status === "expired" || run.status === "succeeded"
  const stateClassName = run.status === "failed"
    ? styles.planError
    : run.status === "cancelled" || run.status === "expired"
      ? styles.planStopped
      : active
        ? styles.planRunning
        : styles.planDraft

  return (
    <section className={`${styles.separationPlan} ${stateClassName}`} aria-label="Stem separation plan" aria-live="polite">
      <header>
        <div><span>Separation plan</span><h4>{studioStemSeparationModeLabel(plan.mode)}</h4></div>
        <span>{stemSeparationStatusLabel(run.status)}</span>
      </header>
      <div className={styles.planFacts}>
        <span><strong>Output</strong>{studioStemSeparationOutputLabel(plan)}</span>
        <span><strong>Notes</strong>{plan.includeMidi ? "MIDI included" : "Audio only"}</span>
        <span><strong>Source</strong>Current version</span>
      </div>
      {active ? <div className={styles.progressBlock}>
        <div><span>{run.status === "preparing" ? "Preparing source" : "Separating parts"}</span><strong>{Math.round(run.progress)}%</strong></div>
        <progress aria-label="Stem separation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress} max={100} value={run.progress} />
      </div> : null}
      {run.message !== null ? <p className={styles.runMessage}>{run.message}</p> : null}
      {run.status === "succeeded" ? <p className={styles.runMessage}>Separation finished without usable stem assets. The plan is ready to retry.</p> : null}
      <footer>
        <span><Check size={12} /> Current version stays untouched.</span>
        <div>
          {!active ? <button type="button" onClick={onEdit}>Edit</button> : null}
          {canCancel ? <button className={styles.cancelButton} type="button" onClick={onCancel}><X size={12} /> Cancel separation</button> : null}
          {run.status === "preparing" ? <button type="button" disabled>Preparing…</button> : null}
          {run.status === "idle" ? <button className={styles.primaryButton} type="button" onClick={onSeparate}>{studioStemSeparationActionLabel(plan)} <Sparkles size={12} /></button> : null}
          {canRetry ? <button className={styles.primaryButton} type="button" onClick={onSeparate}>Retry separation <RotateCcw size={12} /></button> : null}
        </div>
      </footer>
    </section>
  )
}

function stemSeparationStatusLabel(status: StudioStemSeparationRunState["status"]): string {
  switch (status) {
    case "idle": return "Ready to separate"
    case "preparing": return "Preparing"
    case "queued": return "Queued"
    case "separating": return "Separating"
    case "succeeded": return "Ready"
    case "failed": return "Needs retry"
    case "cancelled": return "Cancelled"
    case "expired": return "Expired"
  }
}

function stemDetail(stem: MoriStem): string {
  switch (stem.kind) {
    case "vocals": return "Primary vocal layer"
    case "backing_vocals": return "Harmony and support"
    case "instrumental": return "Music without vocals"
    case "drums": return "Percussion and transients"
    case "bass": return "Low-frequency foundation"
    case "guitar": return "Guitar layers"
    case "keys": return "Piano and keyboard layers"
    case "strings": return "String ensemble layers"
    case "wind": return "Woodwind and brass layers"
    case "synth": return "Synthesizer layers"
    case "percussion": return "Additional percussion"
    case "other": return "Remaining instruments"
  }
}

function stemSeed(stem: MoriStem, index: number): number {
  return stem.stem_ref.length * 7 + index * 13
}

function formatDuration(durationSeconds: number): string {
  return `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`
}
