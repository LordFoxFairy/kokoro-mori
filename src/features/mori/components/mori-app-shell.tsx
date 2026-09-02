"use client"

import { type CSSProperties, type ReactNode } from "react"
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
  const { railCollapsed, toggleRail, playerCandidate, playing, togglePlaying } = useMoriApp()

  const shellStyle = { "--mori-rail-width": railCollapsed ? "76px" : "224px" } as CSSProperties
  const className = `${styles.appShell} ${styles.appShellWithPlayer}`

  return (
    <div className={className} data-rail-collapsed={railCollapsed} style={shellStyle}>
      <MoriRail
        project={project}
        activeKey={activeKey}
        collapsed={railCollapsed}
        onToggle={toggleRail}
      />
      <section className={styles.surface} aria-label={ariaLabel}>
        {children}
      </section>
      <div className={styles.globalPlayerSlot}>
        <PersistentPlayer
          candidate={playerCandidate}
          playing={playing}
          onToggle={togglePlaying}
          onSelectQueue={showQueueButton ? onQueueOpen : undefined}
        />
      </div>
    </div>
  )
}
