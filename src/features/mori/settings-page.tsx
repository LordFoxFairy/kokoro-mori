"use client"

import Link from "next/link"
import { Check, Headphones, Keyboard, Palette, Sparkles, UserRound, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useMoriApp } from "./components/mori-app-provider"
import styles from "./mori-workspace.module.css"

type SettingsSection = "appearance" | "playback" | "creation" | "account"

type MoriSettingsPageProps = {
  returnTo?: string
}

const sections: Array<{ key: SettingsSection; label: string; description: string; icon: typeof Palette }> = [
  { key: "appearance", label: "Appearance", description: "Workspace mood and shell", icon: Palette },
  { key: "playback", label: "Playback", description: "Player and listening behavior", icon: Headphones },
  { key: "creation", label: "Creation", description: "Defaults for new directions", icon: Sparkles },
  { key: "account", label: "Account", description: "Profile and workspace plan", icon: UserRound },
]

export function MoriSettingsPage({ returnTo = "/" }: MoriSettingsPageProps = {}) {
  const [section, setSection] = useState<SettingsSection>("appearance")
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const closeLinkRef = useRef<HTMLAnchorElement>(null)
  const settingsDialogRef = useRef<HTMLElement>(null)
  const { railCollapsed, setRailCollapsed, preferences, updatePreferences } = useMoriApp()
  const returnLabel = settingsReturnLabel(returnTo)

  useEffect(() => {
    const timer = window.setTimeout(() => setPortalTarget(document.body), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (portalTarget === null) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.setTimeout(() => closeLinkRef.current?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeLinkRef.current?.click()
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
  }, [portalTarget])

  const settingsWindow = (
    <div className={styles.settingsPage} data-testid="settings-overlay">
      <Link className={styles.settingsBackdrop} href={returnTo} aria-label="Close settings" />
      <section ref={settingsDialogRef} className={styles.settingsWindow} role="dialog" aria-modal="true" aria-labelledby="mori-settings-title">
        <nav className={styles.settingsNav} aria-label="Settings sections">
          <div className={styles.settingsNavBrand}>
            <div className={styles.settingsNavBrandMark} aria-hidden="true">M</div>
            <div className={styles.settingsNavBrandCopy}>
              <strong>Mori</strong>
              <span>Music workspace</span>
            </div>
          </div>
          <div className={styles.settingsNavSection}>
            <span className={styles.settingsNavLabel}>Preferences</span>
          {sections.map(({ key, label, description, icon: Icon }) => (
            <button
              className={styles.settingsNavItem}
              type="button"
              key={key}
              aria-current={section === key ? "page" : undefined}
              data-active={section === key}
              onClick={() => setSection(key)}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
          </div>
          <div className={styles.settingsNavDivider} />
          <div className={styles.settingsNavNote}><Keyboard size={14} aria-hidden="true" /><span>Shortcuts stay in the editor so the studio stays focused.</span></div>
        </nav>

        <div className={styles.settingsWindowContent}>
          <header className={styles.settingsWindowHeader}>
            <div className={styles.settingsWindowHeaderCopy}>
              <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Workspace controls</div>
              <h1 className={styles.settingsWindowTitle} id="mori-settings-title">Settings</h1>
              <p>Shape the way Mori creates, plays, and presents your music.</p>
            </div>
            <Link ref={closeLinkRef} className={styles.settingsClose} href={returnTo} aria-label={returnLabel}>
              <span>{returnLabel}</span>
              <X size={17} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </header>

          <section className={styles.settingsMain} aria-live="polite">
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
          </section>
        </div>
      </section>
    </div>
  )

  return portalTarget === null ? settingsWindow : createPortal(settingsWindow, portalTarget)
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
