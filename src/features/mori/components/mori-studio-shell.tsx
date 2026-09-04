"use client"

import type { ReactNode } from "react"
import { MoriAppShell } from "./mori-app-shell"
import styles from "../mori-workspace.module.css"

type MoriStudioShellProps = {
  children: ReactNode
}

export function MoriStudioShell({ children }: MoriStudioShellProps) {
  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
