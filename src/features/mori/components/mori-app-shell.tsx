"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { previewProject } from "../preview-data"
import type { Project } from "../domain"
import { MoriRail, type MoriNavigationKey } from "./mori-rail"
import styles from "../mori-workspace.module.css"

type MoriAppShellProps = {
  activeKey: MoriNavigationKey
  ariaLabel: string
  children: ReactNode
  player?: ReactNode
  project?: Project
}

export function MoriAppShell({ activeKey, ariaLabel, children, player, project = previewProject }: MoriAppShellProps) {
  const [railCollapsed, setRailCollapsed] = useState(false)

  useEffect(() => {
    if (window.innerWidth <= 700) {
      const compactTimer = window.setTimeout(() => setRailCollapsed(true), 0)
      return () => window.clearTimeout(compactTimer)
    }
  }, [])

  const shellStyle = { "--mori-rail-width": railCollapsed ? "76px" : "224px" } as CSSProperties
  const className = `${styles.appShell} ${player ? styles.appShellWithPlayer : ""}`

  return (
    <div className={className} data-rail-collapsed={railCollapsed} style={shellStyle}>
      <MoriRail
        project={project}
        activeKey={activeKey}
        collapsed={railCollapsed}
        onToggle={() => setRailCollapsed((value) => !value)}
      />
      <section className={styles.surface} aria-label={ariaLabel}>
        {children}
      </section>
      {player ? <div className={styles.globalPlayerSlot}>{player}</div> : null}
    </div>
  )
}
