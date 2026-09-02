"use client"

import { type ReactNode } from "react"
import { MoriAppShell } from "./mori-app-shell"

type MoriCatalogShellProps = {
  activeKey: "home" | "projects" | "library"
  ariaLabel: string
  children: ReactNode
}

export function MoriCatalogShell({ activeKey, ariaLabel, children }: MoriCatalogShellProps) {
  return (
    <MoriAppShell
      activeKey={activeKey}
      ariaLabel={ariaLabel}
    >
      {children}
    </MoriAppShell>
  )
}
