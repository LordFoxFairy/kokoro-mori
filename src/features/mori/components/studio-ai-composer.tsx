"use client"

import { ArrowRight, Check, Pencil, Plus, RotateCcw, Scissors, SlidersHorizontal, Sparkles, Square } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId, useState } from "react"
import type { FormEvent } from "react"
import type { GenerationStatus } from "../domain"
import {
  buildStudioChangePlan,
  defaultStudioChangePreserve,
  isActiveStudioChangeStatus,
  studioChangeScopeLabel,
  studioChangeOutputCounts,
  type StudioChangeOutputCount,
  type StudioChangePlan,
  type StudioTimelineSection,
  type StudioTransformScope,
} from "../studio-change"
import type { StudioChangeOperation, StudioChangePreserve } from "@/lib/mori-api"
import styles from "./studio-ai-composer.module.css"

type StudioAiOperationConfig = {
  id: StudioChangeOperation
  label: string
  placeholder: string
  Icon: LucideIcon
}

export type StudioAiRunState = {
  status: "idle" | GenerationStatus
  progress: number
  resultCount: number
  plan: StudioChangePlan | null
  message: string | null
}

type StudioAiComposerProps = {
  selectedSection: StudioTimelineSection
  run: StudioAiRunState
  onGenerate: (plan: StudioChangePlan) => void
  onCancel: () => void
  onReset: () => void
}

const operations: readonly StudioAiOperationConfig[] = [
  {
    id: "add_part",
    label: "Add part",
    placeholder: "Describe what should enter after the selected section…",
    Icon: Plus,
  },
  {
    id: "replace_section",
    label: "Replace section",
    placeholder: "Describe how the selected section should feel…",
    Icon: Scissors,
  },
  {
    id: "extend",
    label: "Extend",
    placeholder: "Describe how Mori should continue from this section…",
    Icon: ArrowRight,
  },
  {
    id: "transform",
    label: "Transform",
    placeholder: "Restyle the selected section while preserving its melody…",
    Icon: Sparkles,
  },
]

const preserveOptions: readonly { id: StudioChangePreserve; label: string }[] = [
  { id: "melody", label: "Melody" },
  { id: "lyrics", label: "Lyrics" },
  { id: "vocal_identity", label: "Voice" },
  { id: "tempo", label: "Tempo" },
  { id: "structure", label: "Structure" },
]

export function StudioAiComposer({ selectedSection, run, onGenerate, onCancel, onReset }: StudioAiComposerProps) {
  const promptId = useId()
  const [operation, setOperation] = useState<StudioChangeOperation>(() => run.plan?.operation ?? "add_part")
  const [instruction, setInstruction] = useState(() => run.plan?.instruction ?? "")
  const [preserve, setPreserve] = useState<StudioChangePreserve[]>(() => [...(run.plan?.preserve ?? defaultStudioChangePreserve)])
  const [outputCount, setOutputCount] = useState<StudioChangeOutputCount>(() => run.plan?.outputCount ?? 2)
  const [transformScope, setTransformScope] = useState<StudioTransformScope>(() => (
    run.plan?.draft.operation === "transform" && run.plan.draft.scope.type === "whole_version"
      ? "whole_version"
      : "selected_section"
  ))
  const [plan, setPlan] = useState<StudioChangePlan | null>(null)
  const activeOperation = getOperation(operation)
  const activeScope = studioChangeScopeLabel(operation, selectedSection, transformScope)
  const busy = isActiveStudioChangeStatus(run.status)
  const reviewedPlan = plan !== null && (
    (plan.draft.operation === "transform" && plan.draft.scope.type === "whole_version")
    || (
      plan.sectionId === selectedSection.id
      && plan.selection.startMs === selectedSection.startMs
      && plan.selection.endMs === selectedSection.endMs
    )
  ) ? plan : null
  const visiblePlan = run.status === "idle" ? reviewedPlan : run.plan

  const clearFinishedRun = () => {
    if (run.status !== "idle" && !busy) onReset()
  }

  const chooseOperation = (nextOperation: StudioChangeOperation) => {
    if (busy) return
    clearFinishedRun()
    setOperation(nextOperation)
    setPlan(null)
  }

  const updateInstruction = (nextInstruction: string) => {
    if (busy) return
    clearFinishedRun()
    setInstruction(nextInstruction)
    setPlan(null)
  }

  const togglePreserve = (item: StudioChangePreserve) => {
    if (busy) return
    clearFinishedRun()
    setPreserve((current) => current.includes(item)
      ? current.filter((value) => value !== item)
      : [...current, item])
    setPlan(null)
  }

  const chooseOutputCount = (nextOutputCount: StudioChangeOutputCount) => {
    if (busy) return
    clearFinishedRun()
    setOutputCount(nextOutputCount)
    setPlan(null)
  }

  const chooseTransformScope = (nextScope: StudioTransformScope) => {
    if (busy) return
    clearFinishedRun()
    setTransformScope(nextScope)
    setPlan(null)
  }

  const reviewChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedInstruction = instruction.trim()
    if (trimmedInstruction === "" || busy) return
    clearFinishedRun()
    setInstruction(trimmedInstruction)
    setPlan(buildStudioChangePlan(operation, selectedSection, trimmedInstruction, {
      preserve,
      outputCount,
      transformScope,
    }))
  }

  const editPlan = () => {
    if (busy) return
    onReset()
    setPlan(null)
    window.requestAnimationFrame(() => document.getElementById(promptId)?.focus())
  }

  const plannedOperation = visiblePlan === null ? null : getOperation(visiblePlan.operation)
  const status = runStatus(run)

  return (
    <section className={styles.studioAi} aria-label="Mori AI changes">
      <header className={styles.studioAiHeader}>
        <div className={styles.studioAiIdentity}>
          <span className={styles.studioAiMark} aria-hidden="true"><Sparkles size={15} /></span>
          <div><span>Mori AI</span><h3>Shape this version</h3></div>
        </div>
        <span className={styles.studioAiSafety}><Check size={12} /> Works on a copy</span>
      </header>

      <div className={styles.studioAiOperations} role="group" aria-label="Change type">
        {operations.map(({ id, label, Icon }) => (
          <button
            className={styles.studioAiOperation}
            type="button"
            aria-pressed={operation === id}
            disabled={busy}
            key={id}
            onClick={() => chooseOperation(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <form className={styles.studioAiForm} onSubmit={reviewChange}>
        <label className={styles.srOnly} htmlFor={promptId}>Tell Mori what to change</label>
        <textarea
          id={promptId}
          className={styles.studioAiPrompt}
          value={instruction}
          rows={2}
          disabled={busy}
          placeholder={activeOperation.placeholder}
          onChange={(event) => updateInstruction(event.target.value)}
        />
        <button className={styles.studioAiReview} type="submit" disabled={instruction.trim() === "" || busy}>
          Review change <ArrowRight size={14} />
        </button>
      </form>

      <details className={styles.studioAiControls}>
        <summary>
          <span><SlidersHorizontal size={13} /> Direction controls</span>
          <span>{preserve.length} anchors · {takeCountLabel(outputCount)}</span>
        </summary>
        <div className={styles.studioAiControlsBody}>
          <div className={styles.studioAiControlGroup} role="group" aria-label="Keep stable">
            <span className={styles.studioAiControlLabel}>Keep stable</span>
            <div className={styles.studioAiChoices}>
              {preserveOptions.map((item) => (
                <button
                  type="button"
                  aria-label={`Keep ${item.label.toLowerCase()}`}
                  aria-pressed={preserve.includes(item.id)}
                  disabled={busy}
                  key={item.id}
                  onClick={() => togglePreserve(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.studioAiControlGroup} role="group" aria-label="Alternatives">
            <span className={styles.studioAiControlLabel}>Alternatives</span>
            <div className={styles.studioAiChoices}>
              {studioChangeOutputCounts.map((count) => (
                <button
                  type="button"
                  aria-pressed={outputCount === count}
                  disabled={busy}
                  key={count}
                  onClick={() => chooseOutputCount(count)}
                >
                  {takeCountLabel(count)}
                </button>
              ))}
            </div>
          </div>
          {operation === "transform" ? (
            <div className={styles.studioAiControlGroup} role="group" aria-label="Transform scope">
              <span className={styles.studioAiControlLabel}>Apply to</span>
              <div className={styles.studioAiChoices}>
                <button type="button" aria-pressed={transformScope === "selected_section"} disabled={busy} onClick={() => chooseTransformScope("selected_section")}>{selectedSection.id === "custom-range" ? "Selected range" : "Selected section"}</button>
                <button type="button" aria-pressed={transformScope === "whole_version"} disabled={busy} onClick={() => chooseTransformScope("whole_version")}>Whole song</button>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <div className={styles.studioAiContext} aria-label="Change context">
        <span><strong>Scope</strong>{activeScope}</span>
        <span><strong>Output</strong>{alternativeCountLabel(outputCount)}</span>
        <span><strong>Destination</strong>Take lanes</span>
      </div>

      {visiblePlan !== null && plannedOperation !== null ? (
        <section className={styles.studioAiPlan} aria-label="AI change plan" aria-live="polite" aria-busy={busy}>
          <header className={styles.studioAiPlanHeader}>
            <div><span>Change plan</span><strong>{plannedOperation.label}</strong></div>
            <span className={status.className}>{status.label}</span>
          </header>
          <p className={styles.studioAiPlanInstruction}>{visiblePlan.instruction}</p>
          <div className={styles.studioAiPlanFacts}>
            <span><strong>Scope</strong>{visiblePlan.scopeLabel}</span>
            <span><strong>Keep</strong>{preserveLabel(visiblePlan.preserve)}</span>
            <span><strong>Result</strong>{alternativeCountLabel(visiblePlan.outputCount)} · Take lanes</span>
          </div>
          {busy ? <div className={styles.studioAiProgressRow}>
            <div
              className={styles.studioAiProgress}
              role="progressbar"
              aria-label="Studio change progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={run.progress}
            >
              <span style={{ width: `${Math.max(0, Math.min(100, run.progress))}%` }} />
            </div>
            <span>{run.progress}%</span>
          </div> : null}
          {run.message !== null ? <p className={styles.studioAiMessage}>{run.message}</p> : null}
          <footer className={styles.studioAiPlanFooter}>
            <span><Check size={13} /> Current version stays untouched.</span>
            <div>
              {busy ? (
                <button className={styles.studioAiCancel} type="button" onClick={onCancel}><Square size={11} fill="currentColor" /> Cancel change</button>
              ) : <>
                <button type="button" onClick={editPlan}><Pencil size={12} /> Edit request</button>
                {run.status === "succeeded" && run.resultCount > 0 ? (
                  <a className={styles.studioAiStage} href="#mori-take-lanes">Review takes <ArrowRight size={12} /></a>
                ) : run.status === "failed" || run.status === "cancelled" || run.status === "expired" || (run.status === "succeeded" && run.resultCount === 0) ? (
                  <button className={styles.studioAiStage} type="button" onClick={() => onGenerate(visiblePlan)}><RotateCcw size={12} /> Retry change</button>
                ) : (
                  <button className={styles.studioAiStage} type="button" onClick={() => onGenerate(visiblePlan)}>Generate {takeCountLabel(visiblePlan.outputCount)} <ArrowRight size={12} /></button>
                )}
              </>}
            </div>
          </footer>
        </section>
      ) : null}
    </section>
  )
}

function getOperation(operation: StudioChangeOperation): StudioAiOperationConfig {
  return operations.find((item) => item.id === operation) ?? operations[0]
}

function takeCountLabel(count: StudioChangeOutputCount): string {
  return `${count} ${count === 1 ? "take" : "takes"}`
}

function alternativeCountLabel(count: StudioChangeOutputCount): string {
  return `${count} ${count === 1 ? "alternative" : "alternatives"}`
}

function preserveLabel(preserve: StudioChangePreserve[]): string {
  const labels: Record<StudioChangePreserve, string> = {
    melody: "Melody",
    lyrics: "Lyrics",
    vocal_identity: "Voice",
    tempo: "Tempo",
    structure: "Structure",
  }
  return preserve.length === 0 ? "No locked elements" : preserve.map((item) => labels[item]).join(" · ")
}

function runStatus(run: StudioAiRunState): { label: string; className: string } {
  switch (run.status) {
    case "idle": return { label: "Review before rendering", className: styles.studioAiPlanDraft }
    case "preparing": return { label: "Starting change", className: styles.studioAiPlanRunning }
    case "queued": return { label: "Queued", className: styles.studioAiPlanRunning }
    case "generating": return { label: "Shaping new takes", className: styles.studioAiPlanRunning }
    case "post_processing": return { label: "Finishing takes", className: styles.studioAiPlanRunning }
    case "succeeded": return run.resultCount > 0
      ? { label: `${run.resultCount} new ${run.resultCount === 1 ? "take" : "takes"} ready below`, className: styles.studioAiPlanReady }
      : { label: "No new takes returned", className: styles.studioAiPlanError }
    case "failed": return { label: "Change failed", className: styles.studioAiPlanError }
    case "cancelled": return { label: "Change cancelled", className: styles.studioAiPlanStopped }
    case "expired": return { label: "Change expired", className: styles.studioAiPlanStopped }
  }
}
