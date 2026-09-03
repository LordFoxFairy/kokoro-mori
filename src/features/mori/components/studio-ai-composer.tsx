"use client"

import { ArrowRight, Check, Pencil, Plus, Scissors, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId, useState } from "react"
import type { FormEvent } from "react"
import styles from "./studio-ai-composer.module.css"

type StudioAiOperation = "add" | "replace" | "extend" | "transform"

type StudioAiOperationConfig = {
  id: StudioAiOperation
  label: string
  placeholder: string
  Icon: LucideIcon
}

type StudioChangePlan = {
  operation: StudioAiOperation
  instruction: string
  scope: string
}

const operations: readonly StudioAiOperationConfig[] = [
  {
    id: "add",
    label: "Add part",
    placeholder: "Describe what should enter after the selected section…",
    Icon: Plus,
  },
  {
    id: "replace",
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

export function StudioAiComposer({ selectedSection }: { selectedSection: string }) {
  const promptId = useId()
  const [operation, setOperation] = useState<StudioAiOperation>("add")
  const [instruction, setInstruction] = useState("")
  const [plan, setPlan] = useState<StudioChangePlan | null>(null)
  const [planReady, setPlanReady] = useState(false)
  const activeOperation = getOperation(operation)
  const activeScope = getScope(operation, selectedSection)

  const chooseOperation = (nextOperation: StudioAiOperation) => {
    setOperation(nextOperation)
    setPlan(null)
    setPlanReady(false)
  }

  const updateInstruction = (nextInstruction: string) => {
    setInstruction(nextInstruction)
    setPlan(null)
    setPlanReady(false)
  }

  const reviewChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedInstruction = instruction.trim()
    if (trimmedInstruction === "") return
    setInstruction(trimmedInstruction)
    setPlan({ operation, instruction: trimmedInstruction, scope: activeScope })
    setPlanReady(false)
  }

  const editPlan = () => {
    setPlan(null)
    setPlanReady(false)
    window.requestAnimationFrame(() => document.getElementById(promptId)?.focus())
  }

  const plannedOperation = plan === null ? null : getOperation(plan.operation)

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
          placeholder={activeOperation.placeholder}
          onChange={(event) => updateInstruction(event.target.value)}
        />
        <button className={styles.studioAiReview} type="submit" disabled={instruction.trim() === ""}>
          Review change <ArrowRight size={14} />
        </button>
      </form>

      <div className={styles.studioAiContext} aria-label="Change context">
        <span><strong>Scope</strong>{activeScope}</span>
        <span><strong>Output</strong>2 alternatives</span>
        <span><strong>Destination</strong>Take lanes</span>
      </div>

      {plan !== null && plannedOperation !== null ? (
        <section className={styles.studioAiPlan} aria-label="AI change plan" aria-live="polite">
          <header className={styles.studioAiPlanHeader}>
            <div><span>Change plan</span><strong>{plannedOperation.label}</strong></div>
            <span className={planReady ? styles.studioAiPlanReady : styles.studioAiPlanDraft}>
              {planReady ? "Ready for rendering" : "Review before rendering"}
            </span>
          </header>
          <p className={styles.studioAiPlanInstruction}>{plan.instruction}</p>
          <div className={styles.studioAiPlanFacts}>
            <span><strong>Scope</strong>{plan.scope}</span>
            <span><strong>Result</strong>2 alternatives · Take lanes</span>
          </div>
          <footer className={styles.studioAiPlanFooter}>
            <span><Check size={13} /> Current version stays untouched.</span>
            <div>
              <button type="button" onClick={editPlan}><Pencil size={12} /> Edit request</button>
              {planReady ? null : <button className={styles.studioAiStage} type="button" onClick={() => setPlanReady(true)}>Stage change <ArrowRight size={12} /></button>}
            </div>
          </footer>
        </section>
      ) : null}
    </section>
  )
}

function getOperation(operation: StudioAiOperation): StudioAiOperationConfig {
  return operations.find((item) => item.id === operation) ?? operations[0]
}

function getScope(operation: StudioAiOperation, selectedSection: string): string {
  if (operation === "add") return `After selected ${selectedSection}`
  if (operation === "extend") return `From selected ${selectedSection}`
  return `Selected section · ${selectedSection}`
}
