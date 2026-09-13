"use client"

import { Check, History, Play, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent } from "react"
import { createPortal } from "react-dom"
import type { Candidate } from "../domain"
import { useMoriModalLayer } from "./mori-modal-isolation"
import { formatMusicTime } from "../format-music-time"
import styles from "./studio-version-history.module.css"

export type StudioCurrentVersionStatus = "unknown" | "none" | "known"

type StudioVersionHistoryProps = {
  candidates: Candidate[]
  projectRef: string
  openVersionRef: string
  currentVersionRef: string | null
  currentVersionStatus: StudioCurrentVersionStatus
  onSelectVersion?: (candidate: Candidate) => void
}

type StudioVersionHistoryDrawerProps = StudioVersionHistoryProps & {
  id: string
  onClose: () => void
}

export function StudioVersionHistoryDrawer({ id, onClose, ...history }: StudioVersionHistoryDrawerProps) {
  const titleId = useId()
  const descriptionId = useId()
  const drawerRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const restoreFocusRef = useRef(true)
  useMoriModalLayer()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return

      const drawer = drawerRef.current
      if (drawer === null) return
      const focusable = getFocusableElements(drawer)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
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
      if (restoreFocusRef.current && previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  function navigate() {
    restoreFocusRef.current = false
    onClose()
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label="Dismiss version history" onClick={onClose} />
      <section
        ref={drawerRef}
        className={styles.drawer}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className={styles.drawerHeader}>
          <span className={styles.drawerIcon} aria-hidden="true"><History size={18} /></span>
          <div>
            <span>Project history</span>
            <h2 id={titleId}>Version history</h2>
            <p id={descriptionId}>{history.currentVersionStatus === "unknown" ? "Current status is unavailable. Refresh before choosing a Version as Current." : "Open an earlier direction without changing which Version is Current."}</p>
          </div>
          <button ref={closeRef} className={styles.closeButton} type="button" aria-label="Close version history" onClick={onClose}><X size={18} /></button>
        </header>
        <div className={styles.drawerBody}>
          <div className={styles.drawerSummary}><span>Versions</span><strong>{history.candidates.length}</strong></div>
          <VersionHistoryList {...history} onNavigate={navigate} />
        </div>
      </section>
    </div>,
    document.body,
  )
}

function VersionHistoryList({ candidates, projectRef, openVersionRef, currentVersionRef, currentVersionStatus, onNavigate, onSelectVersion }: StudioVersionHistoryProps & { onNavigate?: () => void }) {
  return (
    <nav className={styles.list} aria-label="Project versions">
      {candidates.map((candidate, index) => {
        const isOpen = candidate.versionRef === openVersionRef
        const isCurrent = currentVersionStatus === "known" && candidate.versionRef === currentVersionRef
        const status = isCurrent ? "Current" : currentVersionStatus === "unknown" ? "Current unavailable" : currentVersionStatus === "none" ? "No Current" : "Draft"
        const duration = formatMusicTime(candidate.durationSeconds)
        const stateLine = [status, isOpen ? "Open" : null, duration].filter((value): value is string => value !== null).join(" · ")
        const accessibleState = [candidate.title, status, isOpen ? "Open" : null, duration].filter((value): value is string => value !== null).join(", ")

        return (
          <Link
            aria-current={isOpen ? "page" : undefined}
            aria-label={accessibleState}
            className={styles.item}
            data-current={isCurrent ? "true" : undefined}
            href={`/projects/${encodeURIComponent(projectRef)}/studio/${encodeURIComponent(candidate.versionRef)}`}
            key={candidate.versionRef}
            onClick={(event) => {
              if (onSelectVersion === undefined || keepsNativeVersionLinkBehavior(event)) {
                onNavigate?.()
                return
              }
              event.preventDefault()
              onNavigate?.()
              onSelectVersion(candidate)
            }}
          >
            <span className={styles.thumb} data-accent={String(index % 3)} aria-hidden="true"><Play size={12} fill="currentColor" /></span>
            <span className={styles.itemCopy}>
              <strong>{candidate.title}</strong>
              <span>{stateLine}</span>
            </span>
            {isCurrent ? <span className={styles.currentMark} aria-hidden="true"><Check size={12} /></span> : null}
          </Link>
        )
      })}
    </nav>
  )
}

function keepsNativeVersionLinkBehavior(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  return event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.altKey
    || event.ctrlKey
    || event.shiftKey
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(","))).filter((element) => element.getAttribute("aria-hidden") !== "true")
}
