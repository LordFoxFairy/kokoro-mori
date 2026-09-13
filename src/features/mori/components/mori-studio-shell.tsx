"use client"

import type { ReactNode } from "react"
import { MoriAppShell } from "./mori-app-shell"
import styles from "../mori-workspace.module.css"

type MoriStudioShellProps = {
  projectRef?: string | null
  projectTitle?: string | null
  children: ReactNode
}

export function MoriStudioShell({ projectRef, projectTitle, children }: MoriStudioShellProps) {
  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
      projectRef={projectRef}
      projectTitle={projectTitle}
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
