"use client"

import { AlertCircle, Check, ChevronRight, Clock3, ListChecks, LoaderCircle, X } from "lucide-react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  emptyGenerationQueueState,
  generationQueueClientPhaseForStatus,
  type GenerationQueueItem,
  type GenerationQueueServerStatus,
} from "../generation-queue"
import {
  readGenerationQueueState,
  subscribeGenerationQueueState,
} from "../generation-queue-storage"
import { useMoriModalLayer } from "./mori-modal-isolation"
import { getMoriPortalHost } from "./mori-app-shell"
import styles from "./studio-generation-queue.module.css"

type StudioGenerationQueueProps = {
  projectRef: string
  activeVersionRef: string | null
}

export function StudioGenerationQueue({ projectRef, activeVersionRef }: StudioGenerationQueueProps) {
  const titleId = useId()
  const panelId = useId()
  const openerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [queueState, setQueueState] = useState(emptyGenerationQueueState)
  const items = useMemo(
    () => queueState.items.filter((item) => item.project_ref === projectRef),
    [projectRef, queueState.items],
  )
  const activeCount = items.filter((item) => isActiveQueueStatus(item.status)).length
  const attentionCount = items.filter((item) => isAttentionQueueStatus(item.status)).length
  const queueStateLabel = activeCount > 0 ? "active" : attentionCount > 0 ? "attention" : "idle"
  useMoriModalLayer(open)

  const refresh = useCallback(() => setQueueState(readGenerationQueueState()), [])

  useEffect(() => {
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) refresh()
    })
    const unsubscribe = subscribeGenerationQueueState((state) => {
      if (!disposed) setQueueState(state)
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const previousFocus = openerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const panel = panelRef.current
    panel?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== "Tab" || panel === null) return
      const focusable = getFocusableElements(panel)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (document.activeElement === panel) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])

  return <>
    <button
      ref={openerRef}
      className={styles.studioQueueButton}
      type="button"
      aria-controls={panelId}
      aria-expanded={open}
      aria-label={open ? "Close generation queue" : "Open generation queue"}
      data-queue-state={queueStateLabel}
      onClick={() => setOpen((value) => !value)}
      title={queueButtonTitle(activeCount, attentionCount)}
    >
      <ListChecks size={14} />
      <span className={styles.studioQueueButtonLabel}>Runs</span>
      {items.length > 0 ? <b>{items.length}</b> : null}
    </button>

    {open && typeof document !== "undefined" ? createPortal(
      <div className={styles.studioQueueLayer}>
        <button className={styles.studioQueueBackdrop} type="button" onClick={() => setOpen(false)} aria-label="Dismiss generation queue" />
        <aside
          ref={panelRef}
          id={panelId}
          className={styles.studioQueuePanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header className={styles.studioQueueHeader}>
            <div>
              <span className={styles.studioQueueKicker}>THIS PROJECT</span>
              <h2 id={titleId}>Generation queue</h2>
              <p>Keep creating while Mori renders your next take.</p>
            </div>
            <button className={styles.studioQueueClose} type="button" onClick={() => setOpen(false)} aria-label="Close generation queue"><X size={16} /></button>
          </header>
          <div className={styles.studioQueueBody}>
            {items.length === 0 ? <div className={styles.studioQueueEmpty} role="status">
              <span className={styles.studioQueueEmptyIcon}><Clock3 size={17} /></span>
              <strong>No runs for this project yet</strong>
              <span>Start a Create direction or shape a version in Studio. Your work will appear here.</span>
            </div> : <>
              <div className={styles.studioQueueSummary}>
                <span>{items.length} {items.length === 1 ? "run" : "runs"}</span>
                <span>{activeCount > 0 ? `${activeCount} in progress` : attentionCount > 0 ? `${attentionCount} needs attention` : "Up to date"}</span>
              </div>
              <ol className={styles.studioQueueItems} aria-label="Project generation runs">
                {items.map((item) => <StudioQueueItem key={item.generation_ref} item={item} activeGenerationRef={queueState.active_generation_ref} activeVersionRef={activeVersionRef} onNavigate={() => setOpen(false)} />)}
              </ol>
            </>}
          </div>
        </aside>
      </div>,
      getMoriPortalHost() ?? document.body,
    ) : null}
  </>
}

function StudioQueueItem({ item, activeGenerationRef, activeVersionRef, onNavigate }: { item: GenerationQueueItem; activeGenerationRef: string | null; activeVersionRef: string | null; onNavigate: () => void }) {
  const active = isActiveQueueStatus(item.status)
  const phase = generationQueueClientPhaseForStatus(item.status)
  const currentTask = item.generation_ref === activeGenerationRef
  const sameVersion = item.source_version_ref !== null && item.source_version_ref === activeVersionRef
  return <li className={`${styles.studioQueueItem} ${currentTask ? styles.studioQueueItemCurrent : ""}`} data-queue-phase={phase}>
    <span className={`${styles.studioQueueStatus} ${styles[`studioQueueStatus${phase}`]}`} aria-hidden="true">
      {phase === "queued" || phase === "streaming" ? <LoaderCircle size={14} /> : phase === "completed" ? <Check size={14} /> : <AlertCircle size={14} />}
    </span>
    <div className={styles.studioQueueItemContent}>
      <div className={styles.studioQueueItemTitle}>
        <strong>{item.label}</strong>
        {currentTask ? <span className={styles.studioQueueCurrent}>Current</span> : null}
      </div>
      <span className={styles.studioQueueItemMeta}>{item.kind === "studio_change" ? "Studio change" : "Create direction"} · {queueStatusLabel(item.status)}</span>
      {sameVersion ? <span className={styles.studioQueueItemContext}>Open version</span> : null}
      <div className={styles.studioQueueProgress} aria-label={`${item.progress}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
        <span style={{ width: `${item.progress}%` }} />
      </div>
      <span className={styles.studioQueueItemHint}>{active ? "Mori is rendering in the background." : item.status === "succeeded" ? `${item.candidate_refs.length} ${item.candidate_refs.length === 1 ? "take" : "takes"} ready to compare.` : item.status === "cancelled" ? "This run was stopped." : "Review the run and decide what to do next."}</span>
      <Link className={styles.studioQueueOpenLink} href={queueDestination(item)} onClick={onNavigate}>
        {item.kind === "studio_change" ? "Open Studio" : "Open Create"} <ChevronRight size={13} />
      </Link>
    </div>
  </li>
}

function queueDestination(item: GenerationQueueItem): string {
  if (item.kind === "studio_change" && item.source_version_ref !== null) {
    return `/projects/${encodeURIComponent(item.project_ref)}/studio/${encodeURIComponent(item.source_version_ref)}?generation_ref=${encodeURIComponent(item.generation_ref)}`
  }
  return `/create?project_ref=${encodeURIComponent(item.project_ref)}&generation_ref=${encodeURIComponent(item.generation_ref)}`
}

function isActiveQueueStatus(status: GenerationQueueServerStatus): boolean {
  return status === "queued" || status === "preparing" || status === "generating" || status === "post_processing"
}

function isAttentionQueueStatus(status: GenerationQueueServerStatus): boolean {
  return status === "failed" || status === "expired"
}

function queueButtonTitle(activeCount: number, attentionCount: number): string {
  if (activeCount > 0) return `${activeCount} ${activeCount === 1 ? "run" : "runs"} in progress`
  if (attentionCount > 0) return `${attentionCount} ${attentionCount === 1 ? "run" : "runs"} needs attention`
  return "Open generation queue"
}

function queueStatusLabel(status: GenerationQueueServerStatus): string {
  switch (status) {
    case "queued": return "Queued"
    case "preparing": return "Preparing"
    case "generating": return "Generating"
    case "post_processing": return "Finishing"
    case "succeeded": return "Ready"
    case "failed": return "Needs attention"
    case "cancelled": return "Cancelled"
    case "expired": return "Expired"
  }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",")))
}
