"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, type CSSProperties, type ReactNode } from "react"
import { previewProject } from "../preview-data"
import type { Project } from "../domain"
import { useMoriApp } from "./mori-app-provider"
import { MoriRail, type MoriNavigationKey } from "./mori-rail"
import { PersistentPlayer } from "./persistent-player"
import styles from "../mori-workspace.module.css"

type MoriAppShellProps = {
  activeKey: MoriNavigationKey
  ariaLabel: string
  children: ReactNode
  onQueueOpen?: () => void
  project?: Project
  showQueueButton?: boolean
}

export function MoriAppShell({ activeKey, ariaLabel, children, onQueueOpen, project = previewProject, showQueueButton = false }: MoriAppShellProps) {
  const { railCollapsed, toggleRail, playerCandidate, playing, muted, positionSeconds, togglePlaying, toggleMuted, previousPlayerCandidate, nextPlayerCandidate } = useMoriApp()

  useEffect(() => {
    if (railCollapsed || window.innerWidth > 700) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleRail()
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [railCollapsed, toggleRail])

  const shellStyle = { "--mori-rail-width": railCollapsed ? "76px" : "224px" } as CSSProperties
  const className = `${styles.appShell} ${styles.appShellWithPlayer}`

  return (
    <div className={className} data-rail-collapsed={railCollapsed} style={shellStyle}>
      <MoriRail
        project={project}
        activeKey={activeKey}
        collapsed={railCollapsed}
      />
      <button className={styles.railToggleGlobal} type="button" onClick={toggleRail} aria-expanded={!railCollapsed} aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {railCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      {!railCollapsed ? <button className={styles.railBackdrop} type="button" onClick={toggleRail} aria-label="Close sidebar" /> : null}
      <section className={styles.surface} aria-label={ariaLabel}>
        {children}
      </section>
      <div className={styles.globalPlayerSlot}>
        <PersistentPlayer
          candidate={playerCandidate}
          playing={playing}
          muted={muted}
          positionSeconds={positionSeconds}
          onToggle={togglePlaying}
          onToggleMute={toggleMuted}
          onPrevious={previousPlayerCandidate}
          onNext={nextPlayerCandidate}
          onSelectQueue={showQueueButton ? onQueueOpen : undefined}
        />
      </div>
    </div>
  )
}
