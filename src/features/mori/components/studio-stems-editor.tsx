"use client"

import { ArrowRight, Check, FileMusic, Layers3, Mic2, Music2, RotateCcw, Scissors, Sparkles, X } from "lucide-react"
import { useState } from "react"
import type { MixRevisionInput, MoriMixRevision, MoriStem, StemSeparationStatus, StemTargetKind } from "@/lib/mori-api"
import { isActiveStudioChangeStatus, type StudioChangePlan } from "../studio-change"
import { isStudioLayerPlan } from "../studio-layers"
import type { MoriCreativeLibrarySource, MoriCreativeSourceStatus } from "../creative-assets"
import type { StemPlaybackFactory } from "../stem-playback"
import {
  buildStudioStemSeparationPlan,
  isActiveStemSeparationStatus,
  studioStemSeparationActionLabel,
  studioStemSeparationModeLabel,
  studioStemSeparationOutputLabel,
  studioStemTargetLabel,
  studioStemTargets,
  type StudioStemSeparationMode,
  type StudioStemSeparationPlan,
} from "../studio-stems"
import { useMoriApp } from "./mori-app-provider"
import { StudioLayerComposer } from "./studio-layer-composer"
import type { StudioAiRunState } from "./studio-ai-composer"
import { StudioStemMixer } from "./studio-stem-mixer"
import styles from "./studio-stems-editor.module.css"

export type StudioStemSeparationRunState = {
  status: "idle" | "preparing" | StemSeparationStatus
  sourceVersionRef: string | null
  stemSeparationRef: string | null
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
  creativeSources?: readonly MoriCreativeLibrarySource[]
  creativeSourceStatus?: MoriCreativeSourceStatus
  onSeparate: (plan: StudioStemSeparationPlan) => void
  onCancel: () => void
  onReset: () => void
  onSaveMix: (input: MixRevisionInput) => Promise<MoriMixRevision>
  onGenerateLayer: (plan: StudioChangePlan) => void
  onCancelLayer: () => void
  onResetLayer: () => void
  onReviewTakes: () => void
  playbackFactory: StemPlaybackFactory
}

const modes = [
  { id: "isolate_part", detail: "One part + mix without it", Icon: Scissors },
  { id: "auto_stems", detail: "Detect up to 12 usable stems", Icon: Sparkles },
  { id: "custom_stems", detail: "Pick 2–10 parts to keep", Icon: Layers3 },
] satisfies readonly { id: StudioStemSeparationMode; detail: string; Icon: typeof Scissors }[]
type StemsWorkflow = "separate" | "vocals" | "instrumental"

const workflows = [
  { id: "separate", label: "Separate mix", Icon: Scissors },
  { id: "vocals", label: "Add vocals", Icon: Mic2 },
  { id: "instrumental", label: "Add instrumental", Icon: Music2 },
] satisfies readonly { id: StemsWorkflow; label: string; Icon: typeof Scissors }[]

export function StudioStemsEditor({ durationSeconds, run, layerRun, creativeSources, creativeSourceStatus = "preview", onSeparate, onCancel, onReset, onSaveMix, onGenerateLayer, onCancelLayer, onResetLayer, onReviewTakes, playbackFactory }: StudioStemsEditorProps) {
  const { playing: globalPlaybackActive, setPlaying: setGlobalPlaying } = useMoriApp()
  const [workflow, setWorkflow] = useState<StemsWorkflow>(() => isStudioLayerPlan(layerRun.plan) ? layerRun.plan.layerKind : "separate")
  const [mode, setMode] = useState<StudioStemSeparationMode>(() => run.plan?.mode ?? "isolate_part")
  const [isolateTarget, setIsolateTarget] = useState<StemTargetKind>(() => run.plan?.mode === "isolate_part" ? run.plan.targetKinds[0] ?? "vocals" : "vocals")
  const [customTargets, setCustomTargets] = useState<StemTargetKind[]>(() => run.plan?.mode === "custom_stems" ? run.plan.targetKinds : [])
  const [includeMidi, setIncludeMidi] = useState(() => run.plan?.includeMidi ?? false)
  const [reviewedPlan, setReviewedPlan] = useState<StudioStemSeparationPlan | null>(() => run.status === "idle" ? null : run.plan)
  const visiblePlan = run.status === "idle" ? reviewedPlan : run.plan
  const ready = run.status === "succeeded" && run.stems.length > 0 && run.stemSeparationRef !== null
  const workflowLocked = isActiveStemSeparationStatus(run.status) || isActiveStudioChangeStatus(layerRun.status)
  const selectedTargetKinds = mode === "isolate_part" ? [isolateTarget] : mode === "custom_stems" ? customTargets : []
  const canReview = mode !== "custom_stems" || customTargets.length >= 2

  const review = () => {
    if (!canReview) return
    setReviewedPlan(buildStudioStemSeparationPlan({ mode, targetKinds: selectedTargetKinds }, includeMidi))
  }

  const editPlan = () => {
    if (visiblePlan === null || isActiveStemSeparationStatus(run.status)) return
    setMode(visiblePlan.mode)
    if (visiblePlan.mode === "isolate_part") setIsolateTarget(visiblePlan.targetKinds[0] ?? "vocals")
    if (visiblePlan.mode === "custom_stems") setCustomTargets(visiblePlan.targetKinds)
    setIncludeMidi(visiblePlan.includeMidi)
    setReviewedPlan(null)
    onReset()
  }

  const startOver = () => {
    if (isActiveStemSeparationStatus(run.status)) return
    setReviewedPlan(null)
    onReset()
  }

  const toggleCustomTarget = (targetKind: StemTargetKind) => {
    setCustomTargets((current) => {
      const selected = new Set(current)
      if (selected.has(targetKind)) selected.delete(targetKind)
      else selected.add(targetKind)
      return studioStemTargets.filter((target) => selected.has(target.kind)).map((target) => target.kind)
    })
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
            <div><span>Mori separation</span><h4>Split what you need from this version.</h4><p>Remove vocals, isolate one part, or turn the full mix into editable stems. The current version remains intact.</p></div>
          </div>
          <div className={styles.modeGrid} role="group" aria-label="Separation mode">
            {modes.map(({ id, detail, Icon }) => (
              <button type="button" aria-label={studioStemSeparationModeLabel(id)} aria-pressed={mode === id} key={id} onClick={() => setMode(id)}>
                <span aria-hidden="true"><Icon size={15} /></span>
                <strong>{studioStemSeparationModeLabel(id)}</strong>
                <small>{detail}</small>
              </button>
            ))}
          </div>
          {mode === "isolate_part" ? (
            <label className={styles.targetPicker}>
              <span><strong>Part to isolate</strong><small>{isolateTarget === "vocals" ? "Returns vocals and an instrumental version." : `Returns ${studioStemTargetLabel(isolateTarget).toLocaleLowerCase()} and the mix without it.`}</small></span>
              <select aria-label="Part to isolate" value={isolateTarget} onChange={(event) => {
                const target = studioStemTargets.find((item) => item.kind === event.target.value)
                if (target !== undefined) setIsolateTarget(target.kind)
              }}>
                {studioStemTargets.map((target) => <option value={target.kind} key={target.kind}>{target.label}</option>)}
              </select>
            </label>
          ) : null}
          {mode === "custom_stems" ? (
            <section className={styles.customTargets} aria-label="Custom stem targets">
              <header><div><strong>Choose parts</strong><small>Select at least two. Mori returns only usable assets.</small></div><span>{customTargets.length} of 10 selected</span></header>
              <div role="group" aria-label="Parts to separate">
                {studioStemTargets.map((target) => (
                  <button type="button" aria-pressed={customTargets.includes(target.kind)} key={target.kind} onClick={() => toggleCustomTarget(target.kind)}>
                    {customTargets.includes(target.kind) ? <Check size={12} aria-hidden="true" /> : null}{target.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <label className={styles.midiOption}>
            <input type="checkbox" aria-label="Export MIDI transcription" checked={includeMidi} onChange={(event) => setIncludeMidi(event.target.checked)} />
            <span aria-hidden="true" />
            <div><strong>Export MIDI transcription</strong><small>Add a note-level draft alongside the audio stems.</small></div>
            <FileMusic size={15} aria-hidden="true" />
          </label>
          <button className={styles.reviewButton} type="button" disabled={!canReview} onClick={review}>Review separation <ArrowRight size={13} /></button>
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
            <div><span>Separated from this version</span><h4>Mix &amp; export</h4></div>
            <button type="button" onClick={startOver}><RotateCcw size={12} /> New separation</button>
          </header>
          <StudioStemMixer stems={run.stems} sourceStemSeparationRef={run.stemSeparationRef ?? ""} externalPlaybackActive={globalPlaybackActive} onPlaybackStart={() => setGlobalPlaying(false)} onSaveMix={onSaveMix} playbackFactory={playbackFactory} />
          {run.midiAssetRef !== null ? <div className={styles.midiReady}><FileMusic size={15} /><div><strong>MIDI transcription ready</strong><span>Stored as a version-bound asset.</span></div></div> : null}
        </section>
      ) : null}

      <div hidden={workflow !== "vocals"}>
        <StudioLayerComposer
          mode="vocals"
          durationSeconds={durationSeconds}
          run={layerRun}
          creativeSources={creativeSources}
          creativeSourceStatus={creativeSourceStatus}
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
          creativeSources={creativeSources}
          creativeSourceStatus={creativeSourceStatus}
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
        <span><strong>Requested</strong>{plan.targetKinds.length === 0 ? "Automatic detection" : plan.targetKinds.map(studioStemTargetLabel).join(" · ")}</span>
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
