"use client"

import { useState, type ReactNode } from "react"
import { previewCandidates, previewProject } from "../preview-data"
import { PersistentPlayer } from "./persistent-player"
import { MoriAppShell } from "./mori-app-shell"

type MoriCatalogShellProps = {
  activeKey: "home" | "projects" | "library"
  ariaLabel: string
  children: ReactNode
}

export function MoriCatalogShell({ activeKey, ariaLabel, children }: MoriCatalogShellProps) {
  const [playing, setPlaying] = useState(false)

  return (
    <MoriAppShell
      activeKey={activeKey}
      ariaLabel={ariaLabel}
      project={previewProject}
      player={
        <PersistentPlayer
          candidate={previewCandidates[0]}
          playing={playing}
          onToggle={() => setPlaying((value) => !value)}
        />
      }
    >
      {children}
    </MoriAppShell>
  )
}
