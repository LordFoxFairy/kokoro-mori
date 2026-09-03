"use client"

import { useCallback, useEffect, type CSSProperties, type ReactNode } from "react"
import { useMoriApp } from "./mori-app-provider"
import { MoriRail, type MoriNavigationKey } from "./mori-rail"
import { PersistentPlayer } from "./persistent-player"
import styles from "../mori-workspace.module.css"

type MoriAppShellProps = {
  activeKey: MoriNavigationKey
  ariaLabel: string
  children: ReactNode
  onQueueOpen?: () => void
  showQueueButton?: boolean
}

export function MoriAppShell({ activeKey, ariaLabel, children, onQueueOpen, showQueueButton = false }: MoriAppShellProps) {
  const { railCollapsed, toggleRail, setRailCollapsed, playerCandidate, playing, muted, positionSeconds, togglePlaying, toggleMuted, seekPlayer, previousPlayerCandidate, nextPlayerCandidate, preferences } = useMoriApp()

  const handleRailNavigation = useCallback(() => {
    if (window.innerWidth <= 700) setRailCollapsed(true)
  }, [setRailCollapsed])

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

  const shellStyle = { "--mori-rail-width": railCollapsed ? "64px" : "256px" } as CSSProperties
  const className = `${styles.appShell} ${styles.appShellWithPlayer}`

  return (
    <div className={className} data-rail-collapsed={railCollapsed} data-reduce-motion={preferences.reduceMotion} style={shellStyle}>
      <MoriRail
        activeKey={activeKey}
        collapsed={railCollapsed}
        onNavigate={handleRailNavigation}
        onToggle={toggleRail}
      />
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
          onSeek={seekPlayer}
          onPrevious={previousPlayerCandidate}
          onNext={nextPlayerCandidate}
          onSelectQueue={showQueueButton ? onQueueOpen : undefined}
        />
      </div>
    </div>
  )
}
