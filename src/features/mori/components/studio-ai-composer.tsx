"use client"

import { ArrowRight, AudioLines, Check, Mic2, Pencil, Plus, RotateCcw, Scissors, SlidersHorizontal, Sparkles, Square } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
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
import { previewReferenceAudios, previewVoiceProfiles } from "../creative-assets"
import {
  studioInstrumentalCoverProtectedAnchors,
  studioVocalCoverProtectedAnchors,
  type StudioChangeOperation,
  type StudioChangePreserve,
  type StudioCoverMode,
  type StudioTransformIntent,
} from "@/lib/mori-api"
import styles from "./studio-ai-composer.module.css"

type StudioAiOperationConfig = {
  id: StudioChangeOperation
  label: string
  description: string
  placeholder: string
  Icon: LucideIcon
}

export type StudioAiRunState = {
  status: "idle" | GenerationStatus
  progress: number
  resultCount: number
  plan: StudioChangePlan | null
  message: string | null
  cancelPending?: boolean
}

type StudioAiComposerProps = {
  selectedSection: StudioTimelineSection
  run: StudioAiRunState
  initialOperation?: StudioChangeOperation | undefined
  initialTransformScope?: StudioTransformScope | undefined
  initialTransformIntent?: StudioTransformIntent | undefined
  onGenerate: (plan: StudioChangePlan) => void
  onCancel: () => void
  onReset: () => void
}

const operations: readonly StudioAiOperationConfig[] = [
  {
    id: "add_part",
    label: "Add part",
    description: "Add a new layer after the selected section.",
    placeholder: "Describe what should enter after the selected section…",
    Icon: Plus,
  },
  {
    id: "replace_section",
    label: "Replace section",
    description: "Rework only the selected section as a fresh take.",
    placeholder: "Describe how the selected section should feel…",
    Icon: Scissors,
  },
  {
    id: "extend",
    label: "Extend",
    description: "Continue from the selected section into new music.",
    placeholder: "Describe how Mori should continue from this section…",
    Icon: ArrowRight,
  },
  {
    id: "transform",
    label: "Transform",
    description: "Change the expression while preserving the parts you choose.",
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

const transformIntents: readonly {
  id: StudioTransformIntent
  label: string
  description: string
  Icon: LucideIcon
}[] = [
  {
    id: "restyle",
    label: "Restyle",
    description: "Change genre, texture, or performance while choosing what stays.",
    Icon: Sparkles,
  },
  {
    id: "cover",
    label: "Cover",
    description: "Create a new performance of the open song as two protected takes.",
    Icon: AudioLines,
  },
]

const operationPromptStarters: Readonly<Record<Exclude<StudioChangeOperation, "transform">, readonly string[]>> = {
  add_part: [
    "Add a restrained string lift",
    "Bring in soft percussion",
    "Layer an answering vocal",
  ],
  replace_section: [
    "Make this section land with more lift",
    "Strip this back to piano and voice",
    "Rebuild the groove with tighter drums",
  ],
  extend: [
    "Continue into a gentle outro",
    "Build toward one final chorus",
    "Let the hook dissolve into ambience",
  ],
}

const restylePromptStarters = [
  "Turn this into warm analog soul",
  "Reframe it as intimate acoustic pop",
  "Push it toward cinematic synthwave",
] as const

const coverPromptStarters: Readonly<Record<StudioCoverMode, readonly string[]>> = {
  vocal: [
    "Re-perform it as a close acoustic duet",
    "Give it a smoky late-night vocal",
    "Make the performance brighter and more urgent",
  ],
  instrumental: [
    "Rebuild it around felt piano and chamber strings",
    "Turn it into a guitar-led instrumental",
    "Make it sparse, cinematic, and beatless",
  ],
}

export function StudioAiComposer({ selectedSection, run, initialOperation, initialTransformScope, initialTransformIntent, onGenerate, onCancel, onReset }: StudioAiComposerProps) {
  const promptId = useId()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [operation, setOperation] = useState<StudioChangeOperation>(() => run.plan?.operation ?? initialOperation ?? "add_part")
  const [instruction, setInstruction] = useState(() => run.plan?.instruction ?? "")
  const [preserve, setPreserve] = useState<StudioChangePreserve[]>(() => [...(run.plan?.preserve ?? defaultStudioChangePreserve)])
  const [outputCount, setOutputCount] = useState<StudioChangeOutputCount>(() => run.plan?.outputCount ?? 2)
  const [transformIntent, setTransformIntent] = useState<StudioTransformIntent>(() => run.plan === null ? initialTransformIntent ?? "restyle" : transformIntentFromPlan(run.plan))
  const [transformScope, setTransformScope] = useState<StudioTransformScope>(() => (
    run.plan?.draft.operation === "transform" && run.plan.draft.scope.type === "whole_version"
      ? "whole_version"
      : initialTransformScope ?? "selected_section"
  ))
  const [coverMode, setCoverMode] = useState<StudioCoverMode>(() => coverModeFromPlan(run.plan))
  const [coverVoiceRef, setCoverVoiceRef] = useState<string>(() => coverVoiceFromPlan(run.plan))
  const [referenceAssetRefs, setReferenceAssetRefs] = useState<string[]>(() => referenceAssetsFromPlan(run.plan))
  const [plan, setPlan] = useState<StudioChangePlan | null>(null)
  const activeOperation = getOperation(operation)
  const isCover = operation === "transform" && transformIntent === "cover"
  const activePreserve = isCover
    ? coverMode === "vocal" ? [...studioVocalCoverProtectedAnchors] : [...studioInstrumentalCoverProtectedAnchors]
    : preserve
  const activeOutputCount: StudioChangeOutputCount = isCover ? 2 : outputCount
  const activeScope = studioChangeScopeLabel(operation, selectedSection, transformScope, transformIntent)
  const promptStarters = studioPromptStarters(operation, transformIntent, coverMode)
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
    if (nextOperation !== operation) setInstruction("")
    if (nextOperation !== "transform") setReferenceAssetRefs([])
    setOperation(nextOperation)
    setPlan(null)
  }

  const updateInstruction = (nextInstruction: string) => {
    if (busy) return
    clearFinishedRun()
    setInstruction(nextInstruction)
    setPlan(null)
  }

  const choosePromptStarter = (starter: string) => {
    updateInstruction(starter)
    promptRef.current?.focus()
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

  const chooseTransformIntent = (nextIntent: StudioTransformIntent) => {
    if (busy) return
    clearFinishedRun()
    if (nextIntent === "cover") setReferenceAssetRefs([])
    setTransformIntent(nextIntent)
    setPlan(null)
  }

  const chooseCoverMode = (nextMode: StudioCoverMode) => {
    if (busy) return
    clearFinishedRun()
    setCoverMode(nextMode)
    setPlan(null)
  }

  const chooseCoverVoice = (nextVoiceRef: string) => {
    if (busy) return
    clearFinishedRun()
    setCoverVoiceRef(nextVoiceRef)
    setPlan(null)
  }

  const toggleReference = (referenceRef: string) => {
    if (busy) return
    clearFinishedRun()
    setReferenceAssetRefs((current) => current.includes(referenceRef)
      ? current.filter((value) => value !== referenceRef)
      : [...current, referenceRef])
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
      transformIntent,
      coverMode,
      coverVoiceRef: coverVoiceRef === "" ? null : coverVoiceRef,
      referenceAssetRefs: isCover ? [] : referenceAssetRefs,
    }))
  }

  const editPlan = () => {
    if (busy) return
    onReset()
    setPlan(null)
    window.requestAnimationFrame(() => promptRef.current?.focus())
  }

  const plannedOperation = visiblePlan === null ? null : studioChangePlanLabel(visiblePlan)
  const visibleCoverDraft = visiblePlan !== null
    && visiblePlan.draft.operation === "transform"
    && visiblePlan.draft.intent === "cover"
    ? visiblePlan.draft
    : null
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

      <div className={styles.studioAiOperationSummary} aria-live="polite">
        <span className={styles.studioAiOperationSummaryIcon} aria-hidden="true"><activeOperation.Icon size={14} /></span>
        <div>
          <strong>{activeOperation.label}</strong>
          <span>{activeOperation.description}</span>
        </div>
      </div>

      {operation === "transform" ? (
        <div className={styles.studioAiIntents} role="group" aria-label="Transform intent">
          {transformIntents.map(({ id, label, description, Icon }) => (
            <button
              className={styles.studioAiIntent}
              type="button"
              aria-label={label}
              aria-pressed={transformIntent === id}
              disabled={busy}
              key={id}
              onClick={() => chooseTransformIntent(id)}
            >
              <span className={styles.studioAiIntentIcon} aria-hidden="true"><Icon size={15} /></span>
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
        </div>
      ) : null}

      {isCover ? (
        <section className={styles.studioAiCoverSetup} aria-label="Cover setup">
          <header>
            <div><AudioLines size={14} /><strong>Audio cover, not release artwork.</strong></div>
            <span>Uses the open Version · no re-upload</span>
          </header>
          <div className={styles.studioAiCoverControls}>
            <div className={styles.studioAiCoverMode} role="group" aria-label="Cover mode">
              <button type="button" aria-label="Vocal cover" aria-pressed={coverMode === "vocal"} disabled={busy} onClick={() => chooseCoverMode("vocal")}><Mic2 size={13} /> Vocal</button>
              <button type="button" aria-label="Instrumental cover" aria-pressed={coverMode === "instrumental"} disabled={busy} onClick={() => chooseCoverMode("instrumental")}><AudioLines size={13} /> Instrumental</button>
            </div>
            {coverMode === "vocal" ? (
              <label className={styles.studioAiVoiceField}>
                <span>Voice profile <small>Optional</small></span>
                <select aria-label="Voice profile" value={coverVoiceRef} disabled={busy} onChange={(event) => chooseCoverVoice(event.target.value)}>
                  <option value="">Natural reinterpretation</option>
                  {previewVoiceProfiles.map((voice) => <option value={voice.ref} key={voice.ref}>{voice.name} · {voice.description}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <p><Check size={12} /> {preserveLabel(activePreserve)} stay fixed</p>
        </section>
      ) : null}

      <form className={styles.studioAiForm} onSubmit={reviewChange}>
        <div className={styles.studioAiPromptStarters} role="group" aria-label="Prompt starters">
          <span>Try a direction</span>
          <div>
            {promptStarters.map((starter) => (
              <button type="button" disabled={busy} key={starter} onClick={() => choosePromptStarter(starter)}>{starter}</button>
            ))}
          </div>
        </div>
        <label className={styles.srOnly} htmlFor={promptId}>Tell Mori what to change</label>
        <textarea
          ref={promptRef}
          id={promptId}
          className={styles.studioAiPrompt}
          value={instruction}
          rows={2}
          disabled={busy}
          placeholder={isCover ? coverPromptPlaceholder(coverMode) : activeOperation.placeholder}
          onChange={(event) => updateInstruction(event.target.value)}
        />
        <button className={styles.studioAiReview} type="submit" disabled={instruction.trim() === "" || busy}>
          Review change <ArrowRight size={14} />
        </button>
      </form>

      {!isCover ? <details className={styles.studioAiControls}>
        <summary>
          <span><SlidersHorizontal size={13} /> Keep &amp; compare</span>
          <span>{referenceAssetRefs.length > 0 ? `${referenceAssetRefs.length} reference · ` : ""}{preserve.length} kept · {takeCountLabel(outputCount)}</span>
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
            <div className={`${styles.studioAiControlGroup} ${styles.studioAiReferenceGroup}`} role="group" aria-label="Reference audio">
              <span className={styles.studioAiControlLabel}>Reference audio <small>Optional</small></span>
              <div className={styles.studioAiChoices}>
                {previewReferenceAudios.map((reference) => (
                  <button
                    type="button"
                    aria-label={`Use ${reference.name} as reference`}
                    aria-pressed={referenceAssetRefs.includes(reference.ref)}
                    disabled={busy}
                    key={reference.ref}
                    onClick={() => toggleReference(reference.ref)}
                  >
                    {reference.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
      </details> : null}

      <div className={styles.studioAiContext} aria-label="Change context">
        <span><strong>Scope</strong>{activeScope}</span>
        <span><strong>Output</strong>{alternativeCountLabel(activeOutputCount)}</span>
        <span><strong>Destination</strong>Take lanes</span>
      </div>

      {visiblePlan !== null && plannedOperation !== null ? (
        <section className={styles.studioAiPlan} aria-label="AI change plan" aria-live="polite" aria-busy={busy}>
          <header className={styles.studioAiPlanHeader}>
            <div><span>Change plan</span><strong>{plannedOperation}</strong></div>
            <span className={status.className}>{status.label}</span>
          </header>
          <p className={styles.studioAiPlanInstruction}>{visiblePlan.instruction}</p>
          <div className={styles.studioAiPlanFacts}>
            <span><strong>Scope</strong>{visiblePlan.scopeLabel}</span>
            {visibleCoverDraft !== null ? <span><strong>Mode</strong>{coverModeLabel(visibleCoverDraft.coverMode)}</span> : null}
            {visibleCoverDraft?.coverMode === "vocal" ? <span><strong>Voice</strong>{coverVoiceLabel(visibleCoverDraft.voiceRef)}</span> : null}
            {visiblePlan.draft.operation === "transform" && visiblePlan.draft.intent === "restyle" && visiblePlan.draft.referenceAssetRefs?.map((referenceRef) => {
              const reference = previewReferenceAudios.find((item) => item.ref === referenceRef)
              return reference === undefined ? null : <span key={reference.ref}><strong>Reference</strong>{reference.name} · {reference.description}</span>
            })}
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
                <button className={styles.studioAiCancel} type="button" disabled={run.cancelPending === true} onClick={onCancel}><Square size={11} fill="currentColor" /> {run.cancelPending === true ? "Stopping…" : "Cancel change"}</button>
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

function studioPromptStarters(operation: StudioChangeOperation, transformIntent: StudioTransformIntent, coverMode: StudioCoverMode): readonly string[] {
  if (operation !== "transform") return operationPromptStarters[operation]
  return transformIntent === "cover" ? coverPromptStarters[coverMode] : restylePromptStarters
}

function transformIntentFromPlan(plan: StudioChangePlan | null): StudioTransformIntent {
  if (plan?.draft.operation !== "transform") return "restyle"
  return plan.draft.intent === "cover" ? "cover" : "restyle"
}

function coverModeFromPlan(plan: StudioChangePlan | null): StudioCoverMode {
  return plan?.draft.operation === "transform" && plan.draft.intent === "cover"
    ? plan.draft.coverMode
    : "vocal"
}

function coverVoiceFromPlan(plan: StudioChangePlan | null): string {
  return plan?.draft.operation === "transform" && plan.draft.intent === "cover"
    ? plan.draft.voiceRef ?? ""
    : ""
}

function referenceAssetsFromPlan(plan: StudioChangePlan | null): string[] {
  return plan?.draft.operation === "transform" && plan.draft.intent === "restyle"
    ? [...(plan.draft.referenceAssetRefs ?? [])]
    : []
}

function studioChangePlanLabel(plan: StudioChangePlan): string {
  if (plan.draft.operation !== "transform") return getOperation(plan.operation).label
  switch (plan.draft.intent) {
    case "restyle": return "Restyle"
    case "cover": return "Cover"
    case "remaster": return "Remaster"
  }
}

function coverPromptPlaceholder(mode: StudioCoverMode): string {
  return mode === "vocal"
    ? "Describe the voice, arrangement, and performance for this cover…"
    : "Describe the instrumental arrangement for this cover…"
}

function coverModeLabel(mode: StudioCoverMode): string {
  return mode === "vocal" ? "Vocal" : "Instrumental"
}

function coverVoiceLabel(voiceRef: string | undefined): string {
  if (voiceRef === undefined) return "Natural reinterpretation"
  const voice = previewVoiceProfiles.find((profile) => profile.ref === voiceRef)
  return voice === undefined ? "Selected Voice profile" : `${voice.name} · ${voice.description}`
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
