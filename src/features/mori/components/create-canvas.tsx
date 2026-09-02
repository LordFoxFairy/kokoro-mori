"use client"

import { useState, type FormEvent } from "react"
import { AudioLines, ChevronDown, Link2, Mic2, Plus, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react"
import type { CreationMode, LyricsMode } from "../domain"
import { t } from "../copy"
import { useMoriApp } from "./mori-app-provider"
import styles from "../mori-workspace.module.css"

export type CreationDraft = {
  prompt: string
  lyricsMode: LyricsMode
  style: string
  voice: string
  durationSeconds: number
}

type CreateCanvasProps = {
  mode: CreationMode
  onModeChange: (mode: CreationMode) => void
  onGenerate: (draft: CreationDraft) => void
}

export function CreateCanvas({ mode, onModeChange, onGenerate }: CreateCanvasProps) {
  const { preferences } = useMoriApp()
  const [prompt, setPrompt] = useState("A warm, late-night track for the drive home, slowly opening into sunrise.")
  const [lyricsMode, setLyricsMode] = useState<LyricsMode>(() => preferences.lyricsMode)
  const [style, setStyle] = useState("Dream pop · intimate · organic")
  const [voice, setVoice] = useState("Natural lead")
  const [durationSeconds, setDurationSeconds] = useState(() => preferences.durationSeconds)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [referenceAdded, setReferenceAdded] = useState(false)
  const [moodsOpen, setMoodsOpen] = useState(false)

  function startWithLyrics() {
    onModeChange("custom")
    setLyricsMode("lyrics")
  }

  function addReference() {
    onModeChange("custom")
    setReferenceAdded((value) => !value)
  }

  function chooseMood(mood: string) {
    onModeChange("custom")
    setStyle(mood)
    setMoodsOpen(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onGenerate({ prompt, lyricsMode, style, voice, durationSeconds })
  }

  return (
    <section aria-labelledby="mori-create-title">
      <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Your creative space</div>
      <h1 className={styles.heroTitle} id="mori-create-title">{t("heroTitle")}</h1>
      <p className={styles.heroDescription}>{t("heroDescription")}</p>

      <div className={styles.modeTabs} role="tablist" aria-label="Creation mode">
        <button className={styles.modeTab} type="button" role="tab" aria-selected={mode === "smart"} onClick={() => onModeChange("smart")}>
          <Sparkles size={13} /> {t("smartLabel")}
        </button>
        <button className={styles.modeTab} type="button" role="tab" aria-selected={mode === "custom"} onClick={() => onModeChange("custom")}>
          <SlidersHorizontal size={13} /> {t("customLabel")}
        </button>
      </div>

      <form className={styles.composerCard} onSubmit={submit}>
        <textarea
          className={styles.promptArea}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("promptPlaceholder")}
          aria-label="Song idea"
        />

        {mode === "custom" ? (
          <div className={styles.customFields}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="lyrics-mode">Lyrics or instrumental</label>
                <select className={styles.selectInput} id="lyrics-mode" value={lyricsMode} onChange={(event) => setLyricsMode(event.target.value as LyricsMode)}>
                  <option value="lyrics">Lyrics</option>
                  <option value="instrumental">Instrumental</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="mori-style">Style</label>
                <input className={styles.textInput} id="mori-style" value={style} onChange={(event) => setStyle(event.target.value)} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.fieldLegend}>Reference</span>
                <button className={styles.referenceButton} type="button" onClick={() => setReferenceAdded((value) => !value)} aria-pressed={referenceAdded} aria-label={referenceAdded ? "Reference audio ready" : "Reference audio"}><Link2 /> {referenceAdded ? "Reference ready" : "Add audio reference"}</button>
              </div>
              <div className={styles.field}>
                <label htmlFor="mori-voice">Voice</label>
                <select className={styles.selectInput} id="mori-voice" value={voice} onChange={(event) => setVoice(event.target.value)}>
                  <option>Natural lead</option>
                  <option>Airy alto</option>
                  <option>Warm tenor</option>
                </select>
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="mori-duration">Duration</label>
                <select className={styles.selectInput} id="mori-duration" value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}>
                  <option value={120}>2:00</option>
                  <option value={180}>3:00</option>
                  <option value={240}>4:00</option>
                  <option value={300}>5:00</option>
                </select>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLegend}>Advanced</span>
                <button className={styles.referenceButton} type="button" onClick={() => setAdvancedOpen((value) => !value)}>
                  <SlidersHorizontal /> {advancedOpen ? "Hide settings" : "Open settings"}
                </button>
              </div>
            </div>
            {advancedOpen ? (
              <div className={styles.planHint} role="note">
                <WandSparkles size={16} />
                <span>Keep the arrangement spacious, let the chorus bloom naturally, and preserve room for a later edit.</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.composerBottom}>
          <div className={styles.promptHint}><AudioLines /> <span>We&apos;ll turn this into an editable song plan first.</span></div>
          <button className={styles.generateButton} type="submit"><Sparkles /> {t("generateLabel")}</button>
        </div>
      </form>

      <div className={styles.planHint} role="note">
        <WandSparkles size={16} />
        <span><strong>Song Plan</strong> will map the mood, tempo, structure, and vocal direction before any version is made.</span>
      </div>

      <div className={styles.quickChips} aria-label="Creative shortcuts">
        <button className={styles.quickChip} type="button" onClick={startWithLyrics}><Mic2 /> Start with lyrics</button>
        <button className={styles.quickChip} type="button" onClick={addReference}><Plus /> {referenceAdded ? "Reference ready" : "Add a reference"}</button>
        <button className={styles.quickChip} type="button" onClick={() => setMoodsOpen((value) => !value)} aria-expanded={moodsOpen}><ChevronDown /> Browse moods</button>
      </div>
      {moodsOpen ? <div className={styles.moodPicker} role="listbox" aria-label="Browse moods">
        {[
          "Dream pop · intimate · organic",
          "Warm soul · live drums · close vocal",
          "Cinematic folk · open horizon · strings",
        ].map((mood) => <button key={mood} type="button" role="option" aria-selected={style === mood} onClick={() => chooseMood(mood)}>{mood}</button>)}
      </div> : null}
    </section>
  )
}
