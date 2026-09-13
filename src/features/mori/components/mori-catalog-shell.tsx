"use client"

import { type ReactNode } from "react"
import { MoriAppShell } from "./mori-app-shell"
import type { MoriNavigationKey } from "./mori-rail"

type MoriCatalogShellProps = {
  activeKey: MoriNavigationKey
  ariaLabel: string
  projectRef?: string | null
  projectTitle?: string | null
  projectMeta?: string | null
  children: ReactNode
}

export function MoriCatalogShell({ activeKey, ariaLabel, projectRef, projectTitle, projectMeta, children }: MoriCatalogShellProps) {
  return (
    <MoriAppShell
      activeKey={activeKey}
      ariaLabel={ariaLabel}
      projectRef={projectRef}
      projectTitle={projectTitle}
      projectMeta={projectMeta}
    >
      {children}
    </MoriAppShell>
  )
}
