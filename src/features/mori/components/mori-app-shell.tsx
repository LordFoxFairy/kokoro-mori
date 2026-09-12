"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useMoriApp } from "./mori-app-provider"
import { MoriRail, type MoriNavigationKey } from "./mori-rail"
import { PlaybackQueue } from "./playback-queue"
import { PersistentPlayer } from "./persistent-player"
import { MoriSettingsPage } from "../settings-page"
import styles from "../mori-workspace.module.css"

type MoriAppShellProps = {
  activeKey: MoriNavigationKey
  ariaLabel: string
  projectRef?: string | null
  children: ReactNode
}

export function MoriAppShell({ activeKey, ariaLabel, projectRef, children }: MoriAppShellProps) {
  const { railCollapsed, toggleRail, playerCandidate, playbackQueue, playerAuditionScope, playing, playerMediaStatus, playerMediaMessage, muted, positionSeconds, togglePlaying, retryPlayerPlayback, toggleMuted, setPlaying, seekPlayer, selectPlayerCandidate, previousPlayerCandidate, nextPlayerCandidate, preferences } = useMoriApp()
  const [playbackQueueOpen, setPlaybackQueueOpen] = useState(false)
  const [settingsReturnTo, setSettingsReturnTo] = useState<string | null>(null)
  const [{ isMobileViewport, mobileRailExpanded }, setViewportState] = useState({
    isMobileViewport: null as boolean | null,
    mobileRailExpanded: false,
  })
  const [appShellElement, setAppShellElement] = useState<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLElement>(null)
  const railToggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const updateViewport = () => {
      const nextIsMobileViewport = window.innerWidth <= 700
      setViewportState((current) => ({
        isMobileViewport: nextIsMobileViewport,
        mobileRailExpanded: nextIsMobileViewport && current.isMobileViewport !== true
          ? false
          : current.mobileRailExpanded,
      }))
    }
    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  const mobileRailOpen = mobileRailExpanded && isMobileViewport === true
  const effectiveRailCollapsed = isMobileViewport === true ? !mobileRailExpanded : railCollapsed

  const handleRailToggle = useCallback(() => {
    const isMobile = window.innerWidth <= 700
    if (isMobile) setViewportState((current) => ({ ...current, mobileRailExpanded: !current.mobileRailExpanded }))
    else toggleRail()
    if (isMobile) window.requestAnimationFrame(() => railToggleRef.current?.focus())
  }, [toggleRail])

  const handleRailNavigation = useCallback(() => {
    if (window.innerWidth <= 700) {
      setViewportState((current) => ({ ...current, mobileRailExpanded: false }))
      window.requestAnimationFrame(() => railToggleRef.current?.focus())
    }
  }, [])

  const openPlaybackQueue = useCallback(() => {
    if (window.innerWidth <= 700) setViewportState((current) => ({ ...current, mobileRailExpanded: false }))
    setPlaybackQueueOpen(true)
  }, [])

  const closePlaybackQueue = useCallback(() => setPlaybackQueueOpen(false), [])
  const openSettings = useCallback((returnTo: string) => {
    setPlaybackQueueOpen(false)
    setViewportState((current) => ({ ...current, mobileRailExpanded: false }))
    setSettingsReturnTo(returnTo)
  }, [])
  const closeSettings = useCallback(() => setSettingsReturnTo(null), [])

  const chooseQueuedCandidate = useCallback((candidate: (typeof playbackQueue)[number]) => {
    if (playerCandidate?.versionRef === candidate.versionRef) {
      togglePlaying()
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }, [playerCandidate?.versionRef, selectPlayerCandidate, setPlaying, togglePlaying])

  useEffect(() => {
    if (!mobileRailOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handleRailToggle()
        return
      }
      if (event.key !== "Tab") return
      const focusableElements = Array.from(railRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (first === undefined || last === undefined) return
      if (!railRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)
    const focusTimer = window.requestAnimationFrame(() => railToggleRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(focusTimer)
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [handleRailToggle, mobileRailOpen])

  const compactPlayer = playerCandidate === null || playerMediaStatus === "unavailable"
  const shellStyle = {
    "--mori-rail-width": effectiveRailCollapsed ? "64px" : "256px",
    ...(compactPlayer ? { "--mori-player-height": "64px", "--mori-player-safe-space": "66px" } : {}),
  } as CSSProperties
  const className = `${styles.appShell} ${styles.appShellWithPlayer}`

  return (
    <div ref={setAppShellElement} className={className} data-mori-app-shell="true" data-rail-collapsed={effectiveRailCollapsed} data-reduce-motion={preferences.reduceMotion} data-viewport-ready={isMobileViewport === null ? "false" : "true"} style={shellStyle}>
      <MoriRail
        activeKey={activeKey}
        collapsed={effectiveRailCollapsed}
        projectRef={projectRef}
        onNavigate={handleRailNavigation}
        onOpenSettings={activeKey === "settings" ? undefined : openSettings}
        onToggle={handleRailToggle}
        railRef={railRef}
        toggleRef={railToggleRef}
      />
      {mobileRailOpen ? <button className={styles.railBackdrop} type="button" onClick={handleRailToggle} aria-label="Close sidebar" /> : null}
      <section className={styles.surface} aria-label={ariaLabel} data-mori-shell-region="true" aria-hidden={mobileRailOpen ? true : undefined} inert={mobileRailOpen ? true : undefined}>
        {children}
      </section>
      <div className={styles.globalPlayerSlot} data-mori-shell-region="true" aria-hidden={mobileRailOpen ? true : undefined} inert={mobileRailOpen ? true : undefined}>
        <PersistentPlayer
          candidate={playerCandidate}
          playing={playing}
          muted={muted}
          positionSeconds={positionSeconds}
          onToggle={togglePlaying}
          onToggleMute={toggleMuted}
          onSeek={seekPlayer}
          playerMediaStatus={playerMediaStatus}
          playerMediaMessage={playerMediaMessage}
          onRetryPlayback={retryPlayerPlayback}
          onPrevious={playbackQueue.length > 1 ? previousPlayerCandidate : undefined}
          onNext={playbackQueue.length > 1 ? nextPlayerCandidate : undefined}
          auditionScope={playerAuditionScope}
          queueOpen={playbackQueueOpen}
          onSelectQueue={playbackQueue.length > 0 ? openPlaybackQueue : undefined}
        />
      </div>
      {playbackQueueOpen && appShellElement !== null ? createPortal(
        <PlaybackQueue
          candidates={playbackQueue}
          currentVersionRef={playerCandidate?.versionRef ?? null}
          playing={playing}
          onChoose={chooseQueuedCandidate}
          onClose={closePlaybackQueue}
        />,
        appShellElement,
      ) : null}
      {settingsReturnTo !== null ? <MoriSettingsPage returnTo={settingsReturnTo} onRequestClose={closeSettings} /> : null}
    </div>
  )
}
