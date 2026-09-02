"use client"

import { Check, Headphones, Keyboard, Palette, Sparkles, UserRound } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useMoriApp } from "./components/mori-app-provider"
import styles from "./mori-workspace.module.css"

type SettingsSection = "appearance" | "playback" | "creation" | "account"

const sections: Array<{ key: SettingsSection; label: string; description: string; icon: typeof Palette }> = [
  { key: "appearance", label: "Appearance", description: "Workspace mood and shell", icon: Palette },
  { key: "playback", label: "Playback", description: "Player and listening behavior", icon: Headphones },
  { key: "creation", label: "Creation", description: "Defaults for new directions", icon: Sparkles },
  { key: "account", label: "Account", description: "Profile and workspace plan", icon: UserRound },
]

export function MoriSettingsPage() {
  const [section, setSection] = useState<SettingsSection>("appearance")
  const { railCollapsed, setRailCollapsed } = useMoriApp()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [rememberTrack, setRememberTrack] = useState(true)
  const [autoplay, setAutoplay] = useState(false)
  const [endBehavior, setEndBehavior] = useState<"stop" | "next">("stop")
  const [defaultMode, setDefaultMode] = useState<"smart" | "custom">("smart")
  const [lyricsMode, setLyricsMode] = useState<"lyrics" | "instrumental">("lyrics")
  const [duration, setDuration] = useState("3 minutes")

  return (
    <div className={`${styles.catalogContent} ${styles.settingsPage}`}>
      <header className={styles.catalogIntro}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Workspace</div>
          <h1 className={styles.catalogTitle}>Settings</h1>
          <p className={styles.catalogDescription}>A small set of controls for making Mori feel like your own studio.</p>
        </div>
      </header>

      <div className={styles.settingsLayout}>
        <nav className={styles.settingsNav} aria-label="Settings sections">
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
          <div className={styles.settingsNavDivider} />
          <div className={styles.settingsNavNote}><Keyboard size={14} aria-hidden="true" /><span>Shortcuts stay in the editor so the studio stays focused.</span></div>
        </nav>

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
                <Toggle pressed={reduceMotion} onChange={setReduceMotion} label={reduceMotion ? "On" : "Off"} />
              </SettingRow>
            </SettingsPanel>
          ) : null}

          {section === "playback" ? (
            <SettingsPanel icon={Headphones} title="Playback" description="Make listening continuous without getting in the way of creating.">
              <SettingRow title="Remember last track" description="Return to the last selected song when you come back to Mori.">
                <Toggle pressed={rememberTrack} onChange={setRememberTrack} label={rememberTrack ? "On" : "Off"} />
              </SettingRow>
              <SettingRow title="Autoplay new takes" description="Start a newly generated direction as soon as it is ready.">
                <Toggle pressed={autoplay} onChange={setAutoplay} label={autoplay ? "On" : "Off"} />
              </SettingRow>
              <SettingRow title="After a track ends" description="Choose what the player should do next.">
                <SegmentedControl
                  ariaLabel="After a track ends"
                  value={endBehavior}
                  options={[{ value: "stop", label: "Stop" }, { value: "next", label: "Play next" }]}
                  onChange={setEndBehavior}
                />
              </SettingRow>
            </SettingsPanel>
          ) : null}

          {section === "creation" ? (
            <SettingsPanel icon={Sparkles} title="Creation" description="Set the starting point for every new idea. You can change these before generating.">
              <SettingRow title="Default mode" description="Smart keeps the first step simple; Custom opens the full control set.">
                <SegmentedControl
                  ariaLabel="Default creation mode"
                  value={defaultMode}
                  options={[{ value: "smart", label: "Smart" }, { value: "custom", label: "Custom" }]}
                  onChange={setDefaultMode}
                />
              </SettingRow>
              <SettingRow title="Default output" description="Choose whether new directions begin with a vocal or an instrumental arrangement.">
                <SegmentedControl
                  ariaLabel="Default output"
                  value={lyricsMode}
                  options={[{ value: "lyrics", label: "Lyrics" }, { value: "instrumental", label: "Instrumental" }]}
                  onChange={setLyricsMode}
                />
              </SettingRow>
              <SettingRow title="Default duration" description="The initial duration shown in the Create form.">
                <label className={styles.settingsSelectWrap}>
                  <span className={styles.srOnly}>Default duration</span>
                  <select className={styles.settingsSelect} value={duration} onChange={(event) => setDuration(event.target.value)}>
                    <option>2 minutes</option>
                    <option>3 minutes</option>
                    <option>4 minutes</option>
                    <option>5 minutes</option>
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
    </div>
  )
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
