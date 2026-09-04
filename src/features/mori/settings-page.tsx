"use client"

import Link from "next/link"
import { AudioLines, Check, Headphones, Palette, Search, Sparkles, UserRound, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { useMoriApp } from "./components/mori-app-provider"
import { isolateMoriShellBackground, lockMoriModalBody } from "./components/mori-modal-isolation"
import styles from "./mori-workspace.module.css"

type SettingsSection = "appearance" | "playback" | "creation" | "account"

type MoriSettingsPageProps = {
  returnTo?: string
  onRequestClose?: () => void
}

const sections: Array<{ key: SettingsSection; label: string; description: string; icon: typeof Palette }> = [
  { key: "appearance", label: "Appearance", description: "Workspace mood and shell", icon: Palette },
  { key: "playback", label: "Playback", description: "Player and listening behavior", icon: Headphones },
  { key: "creation", label: "Creation", description: "Defaults for new directions", icon: Sparkles },
  { key: "account", label: "Account", description: "Profile and workspace plan", icon: UserRound },
]

export function MoriSettingsPage({ returnTo = "/", onRequestClose }: MoriSettingsPageProps = {}) {
  const [section, setSection] = useState<SettingsSection>("appearance")
  const [navQuery, setNavQuery] = useState("")
  const closeControlRef = useRef<HTMLElement>(null)
  const settingsDialogRef = useRef<HTMLElement>(null)
  const settingsOverlayRef = useRef<HTMLDivElement>(null)
  const { railCollapsed, setRailCollapsed, preferences, updatePreferences } = useMoriApp()
  const returnLabel = settingsReturnLabel(returnTo)
  const visibleSections = filterSettingsSections(navQuery)
  const captureCloseControl = useCallback((element: HTMLElement | null) => {
    closeControlRef.current = element
  }, [])

  const handleNavQueryChange = (nextQuery: string) => {
    const nextVisibleSections = filterSettingsSections(nextQuery)
    setNavQuery(nextQuery)
    setSection((currentSection) => (
      nextVisibleSections.some(({ key }) => key === currentSection)
        ? currentSection
        : nextVisibleSections[0]?.key ?? currentSection
    ))
  }

  const handleSectionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentSection: SettingsSection) => {
    if (!["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"].includes(event.key)) return
    event.preventDefault()

    const currentIndex = visibleSections.findIndex(({ key }) => key === currentSection)
    if (currentIndex < 0) return

    let nextIndex = currentIndex
    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = visibleSections.length - 1
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (currentIndex + 1) % visibleSections.length
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + visibleSections.length) % visibleSections.length

    const nextSection = visibleSections[nextIndex]
    if (nextSection === undefined) return
    setSection(nextSection.key)
    document.getElementById(`mori-settings-tab-${nextSection.key}`)?.focus()
  }

  useEffect(() => {
    return lockMoriModalBody()
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.setTimeout(() => closeControlRef.current?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        if (onRequestClose !== undefined) onRequestClose()
        else closeControlRef.current?.click()
        return
      }
      if (event.key !== "Tab") return

      const dialog = settingsDialogRef.current
      if (dialog === null) return
      const focusable = getFocusableElements(dialog)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener("keydown", handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onRequestClose])

  useEffect(() => {
    return isolateMoriShellBackground()
  }, [])

  const settingsWindow = (
    <div ref={settingsOverlayRef} className={styles.settingsPage} data-testid="settings-overlay">
      {onRequestClose === undefined
        ? <Link className={styles.settingsBackdrop} href={returnTo} aria-label="Close settings" />
        : <button className={styles.settingsBackdrop} type="button" onClick={onRequestClose} aria-label="Close settings" />}
      <section ref={settingsDialogRef} className={styles.settingsWindow} role="dialog" aria-modal="true" aria-labelledby="mori-settings-title">
        <nav className={styles.settingsNav} aria-label="Settings navigation">
          <div className={styles.settingsNavBrand}>
            <div className={styles.settingsNavBrandMark} aria-hidden="true"><AudioLines size={18} strokeWidth={1.9} /></div>
            <div className={styles.settingsNavBrandCopy}>
              <strong>Mori</strong>
              <span>Music workspace</span>
            </div>
          </div>
          <label className={styles.settingsSearch}>
            <Search size={15} aria-hidden="true" />
            <input
              value={navQuery}
              aria-label="Search settings"
              placeholder="Search settings"
              onChange={(event) => handleNavQueryChange(event.target.value)}
            />
          </label>
          <span className={styles.settingsNavLabel} id="mori-settings-sections-label">Preferences</span>
          <div className={styles.settingsNavSection} role="tablist" aria-label="Settings sections">
            {visibleSections.map(({ key, label, icon: Icon }) => (
              <button
                className={styles.settingsNavItem}
                type="button"
                key={key}
                id={`mori-settings-tab-${key}`}
                role="tab"
                aria-selected={section === key}
                aria-controls={`mori-settings-panel-${key}`}
                tabIndex={section === key ? 0 : -1}
                data-active={section === key}
                onClick={() => setSection(key)}
                onKeyDown={(event) => handleSectionKeyDown(event, key)}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {visibleSections.length === 0 ? <p className={styles.settingsNavEmpty}>No matching sections</p> : null}
          <div className={styles.settingsNavDivider} />
          <div className={styles.settingsNavNote}>Mori music workspace</div>
        </nav>

        <div className={styles.settingsWindowContent}>
          <header className={styles.settingsWindowHeader}>
            <div className={styles.settingsWindowHeaderCopy}>
              <h1 className={styles.settingsWindowTitle} id="mori-settings-title">Settings</h1>
              <p>Manage the workspace without leaving your project.</p>
            </div>
            {onRequestClose === undefined
              ? <Link ref={captureCloseControl} className={styles.settingsClose} href={returnTo} aria-label={returnLabel}>
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
              : <button ref={captureCloseControl} className={styles.settingsClose} type="button" onClick={onRequestClose} aria-label={returnLabel}>
                <X size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>}
          </header>

          <section className={styles.settingsMain} aria-live="polite">
            {visibleSections.length === 0 ? <div className={styles.settingsSearchEmpty} role="status">
              <span aria-hidden="true"><Search size={18} /></span>
              <h2>No settings found</h2>
              <p>Try another word or clear the search to see every preference.</p>
            </div> : <>
            <div id="mori-settings-panel-appearance" role="tabpanel" aria-labelledby="mori-settings-tab-appearance" hidden={section !== "appearance"}>
              {section === "appearance" ? (
                <SettingsPanel icon={Palette} title="Appearance" description="Keep the studio light, quiet, and easy to scan.">
                  <SettingRow title="Theme" description="Mori uses a warm light canvas with lavender, peach, and mint accents.">
                    <div className={styles.themeChoice} aria-label="Theme">
                      <span className={styles.themeSwatch} aria-hidden="true" />
                      <strong>Light gradient</strong>
                      <Check size={15} aria-hidden="true" />
                    </div>
                  </SettingRow>
                  <SettingRow title="Desktop sidebar" description="Choose how much navigation is visible when you open Mori.">
                    <SegmentedControl
                      ariaLabel="Desktop sidebar"
                      value={railCollapsed ? "compact" : "expanded"}
                      options={[{ value: "expanded", label: "Expanded" }, { value: "compact", label: "Compact" }]}
                      onChange={(value) => setRailCollapsed(value === "compact")}
                    />
                  </SettingRow>
                  <SettingRow title="Reduce motion" description="Use calmer transitions throughout the workspace.">
                    <Toggle pressed={preferences.reduceMotion} onChange={(value) => updatePreferences({ reduceMotion: value })} label={preferences.reduceMotion ? "On" : "Off"} />
                  </SettingRow>
                </SettingsPanel>
              ) : null}
            </div>

            <div id="mori-settings-panel-playback" role="tabpanel" aria-labelledby="mori-settings-tab-playback" hidden={section !== "playback"}>
              {section === "playback" ? (
                <SettingsPanel icon={Headphones} title="Playback" description="Make listening continuous without getting in the way of creating.">
                  <SettingRow title="Autoplay new takes" description="Start a newly generated direction as soon as it is ready.">
                    <Toggle pressed={preferences.autoplay} onChange={(value) => updatePreferences({ autoplay: value })} label={preferences.autoplay ? "On" : "Off"} />
                  </SettingRow>
                  <SettingRow title="After a track ends" description="Choose what the player should do next.">
                    <SegmentedControl
                      ariaLabel="After a track ends"
                      value={preferences.endBehavior}
                      options={[{ value: "stop", label: "Stop" }, { value: "next", label: "Play next" }]}
                      onChange={(value) => updatePreferences({ endBehavior: value })}
                    />
                  </SettingRow>
                </SettingsPanel>
              ) : null}
            </div>

            <div id="mori-settings-panel-creation" role="tabpanel" aria-labelledby="mori-settings-tab-creation" hidden={section !== "creation"}>
              {section === "creation" ? (
                <SettingsPanel icon={Sparkles} title="Creation" description="Set the starting point for every new idea. You can change these before generating.">
                  <SettingRow title="Default mode" description="Smart keeps the first step simple; Custom opens the full control set.">
                    <SegmentedControl
                      ariaLabel="Default creation mode"
                      value={preferences.defaultMode}
                      options={[{ value: "smart", label: "Smart" }, { value: "custom", label: "Custom" }]}
                      onChange={(value) => updatePreferences({ defaultMode: value })}
                    />
                  </SettingRow>
                  <SettingRow title="Default output" description="Choose whether new directions begin with a vocal or an instrumental arrangement.">
                    <SegmentedControl
                      ariaLabel="Default output"
                      value={preferences.lyricsMode}
                      options={[{ value: "lyrics", label: "Lyrics" }, { value: "instrumental", label: "Instrumental" }]}
                      onChange={(value) => updatePreferences({ lyricsMode: value })}
                    />
                  </SettingRow>
                  <SettingRow title="Default duration" description="The initial duration shown in the Create form.">
                    <label className={styles.settingsSelectWrap}>
                      <span className={styles.srOnly}>Default duration</span>
                      <select className={styles.settingsSelect} value={preferences.durationSeconds} onChange={(event) => updatePreferences({ durationSeconds: Number(event.target.value) })}>
                        <option value="120">2 minutes</option>
                        <option value="180">3 minutes</option>
                        <option value="240">4 minutes</option>
                        <option value="300">5 minutes</option>
                      </select>
                    </label>
                  </SettingRow>
                </SettingsPanel>
              ) : null}
            </div>

            <div id="mori-settings-panel-account" role="tabpanel" aria-labelledby="mori-settings-tab-account" hidden={section !== "account"}>
              {section === "account" ? (
                <SettingsPanel icon={UserRound} title="Account" description="The essentials for your Mori workspace.">
                  <div className={styles.accountIdentity}>
                    <div className={styles.accountAvatar} aria-hidden="true">M</div>
                    <div><strong>Mori creator</strong><span>Preview workspace</span></div>
                  </div>
                  <SettingRow title="Workspace plan" description="Preview mode keeps the complete creative loop available without provider usage.">
                    <span className={styles.settingsValue}>Preview</span>
                  </SettingRow>
                  <SettingRow title="Audio ownership" description="Generated audio will be linked to this workspace when the Music owner is connected.">
                    <span className={styles.settingsValue}>Workspace library</span>
                  </SettingRow>
                </SettingsPanel>
              ) : null}
            </div>
            </>}
          </section>
        </div>
      </section>
    </div>
  )

  return settingsWindow
}

function filterSettingsSections(query: string): typeof sections {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (normalizedQuery === "") return sections
  return sections.filter(({ label, description }) => (
    `${label} ${description}`.toLocaleLowerCase().includes(normalizedQuery)
  ))
}

function settingsReturnLabel(returnTo: string): string {
  if (returnTo.includes("/studio/")) return "Back to studio"
  if (returnTo === "/projects") return "Back to projects"
  if (returnTo.startsWith("/projects/")) return "Back to project"
  if (returnTo.startsWith("/create")) return "Back to create"
  if (returnTo === "/library") return "Back to library"
  return "Back to home"
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",")))
}

function SettingsPanel({ icon: Icon, title, description, children }: { icon: typeof Palette; title: string; description: string; children: ReactNode }) {
  return (
    <div className={styles.settingsPanel}>
      <header className={styles.settingsPanelHeader}>
        <div className={styles.settingsPanelIcon} aria-hidden="true"><Icon size={17} /></div>
        <div><h2>{title}</h2><p>{description}</p></div>
      </header>
      <div className={styles.settingsCard}>{children}</div>
    </div>
  )
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingRowCopy}><strong>{title}</strong><span>{description}</span></div>
      <div className={styles.settingRowControl}>{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string>({ ariaLabel, value, options, onChange }: { ariaLabel: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className={styles.settingsSegmented} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ pressed, onChange, label }: { pressed: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button className={styles.settingsToggle} type="button" aria-pressed={pressed} onClick={() => onChange(!pressed)}>
      <span aria-hidden="true" />
      <b>{label}</b>
    </button>
  )
}
