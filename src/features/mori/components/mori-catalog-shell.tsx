"use client"

import { type ReactNode } from "react"
import { MoriAppShell } from "./mori-app-shell"
import type { MoriNavigationKey } from "./mori-rail"

type MoriCatalogShellProps = {
  activeKey: MoriNavigationKey
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
