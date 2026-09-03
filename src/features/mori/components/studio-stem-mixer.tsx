"use client"

import { Check, Download, Pause, Play, Save, Volume2, VolumeX } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createMixRevisionRequest, type MixRevisionInput, type MoriMixRevision, type MoriStem } from "@/lib/mori-api"
import { buildMoriAssetContentUrl } from "@/lib/mori-media"
import {
  createHtmlStemPlaybackController,
  type StemMixTrack,
  type StemPlaybackController,
  type StemPlaybackFactory,
} from "../stem-playback"
import { Waveform } from "./waveform"
import styles from "./studio-stem-mixer.module.css"

type StudioStemMixerProps = {
  stems: readonly MoriStem[]
  sourceStemSeparationRef: string
  externalPlaybackActive: boolean
  onPlaybackStart: () => void
  onSaveMix: (input: MixRevisionInput) => Promise<MoriMixRevision>
  playbackFactory?: StemPlaybackFactory
}

const playbackFailureMessage = "Stem audio is unavailable right now. Check the connection and try again."

export function StudioStemMixer({ stems, sourceStemSeparationRef, externalPlaybackActive, onPlaybackStart, onSaveMix, playbackFactory = createHtmlStemPlaybackController }: StudioStemMixerProps) {
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [positionSeconds, setPositionSeconds] = useState(0)
  const [mutedStemRefs, setMutedStemRefs] = useState<string[]>([])
  const [soloStemRef, setSoloStemRef] = useState<string | null>(null)
  const [gains, setGains] = useState<Record<string, number>>(() => initialGains(stems))
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [mixName, setMixName] = useState("Stem mix")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null)
  const [savedRevision, setSavedRevision] = useState<MoriMixRevision | null>(null)
  const controllerRef = useRef<StemPlaybackController | null>(null)
  const playbackRequestRef = useRef(0)
  const durationSeconds = stems.reduce((duration, stem) => Math.max(duration, stem.duration_seconds), 0)
  const mix = useMemo<StemMixTrack[]>(() => stems.map((stem) => ({
    stemRef: stem.stem_ref,
    gain: gains[stem.stem_ref] ?? 1,
    muted: mutedStemRefs.includes(stem.stem_ref),
    solo: soloStemRef === stem.stem_ref,
  })), [gains, mutedStemRefs, soloStemRef, stems])
  const mixRevisionInput = useMemo(() => buildMixRevisionInput(sourceStemSeparationRef, mixName, mix), [mix, mixName, sourceStemSeparationRef])
  const mixFingerprint = mixRevisionInput === null ? null : JSON.stringify(mixRevisionInput)
  const mixChanged = mixFingerprint !== savedFingerprint
  const matchesSavedRevision = savedFingerprint !== null && !mixChanged

  useEffect(() => {
    const controller = playbackFactory({
      onPosition: (position) => setPositionSeconds(clamp(position, 0, durationSeconds)),
      onEnded: () => {
        playbackRequestRef.current += 1
        setPlaying(false)
        setStarting(false)
        setPositionSeconds(0)
      },
      onError: () => {
        playbackRequestRef.current += 1
        setPlaying(false)
        setStarting(false)
        setPlaybackError(playbackFailureMessage)
      },
    })
    controllerRef.current = controller
    controller.setTracks(stems)
    return () => {
      playbackRequestRef.current += 1
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [durationSeconds, playbackFactory, stems])

  useEffect(() => {
    controllerRef.current?.setMix(mix)
  }, [mix])

  useEffect(() => {
    if (!externalPlaybackActive) return
    playbackRequestRef.current += 1
    controllerRef.current?.pause()
    const timer = window.setTimeout(() => {
      setPlaying(false)
      setStarting(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [externalPlaybackActive])

  const togglePlayback = async () => {
    const controller = controllerRef.current
    if (controller === null) return
    if (playing || starting) {
      playbackRequestRef.current += 1
      controller.pause()
      setPlaying(false)
      setStarting(false)
      return
    }

    const request = playbackRequestRef.current + 1
    playbackRequestRef.current = request
    setPlaybackError(null)
    setStarting(true)
    onPlaybackStart()
    try {
      await controller.play(positionSeconds)
      if (playbackRequestRef.current !== request) return
      setPlaying(true)
    } catch {
      if (playbackRequestRef.current !== request) return
      setPlaying(false)
      setPlaybackError(playbackFailureMessage)
    } finally {
      if (playbackRequestRef.current === request) setStarting(false)
    }
  }

  const seek = (position: number) => {
    const nextPosition = clamp(position, 0, durationSeconds)
    setPositionSeconds(nextPosition)
    controllerRef.current?.seek(nextPosition)
  }

  const toggleMute = (stemRef: string) => {
    setMutedStemRefs((current) => current.includes(stemRef) ? current.filter((item) => item !== stemRef) : [...current, stemRef])
  }

  const setGain = (stemRef: string, gainPercent: number) => {
    setGains((current) => ({ ...current, [stemRef]: clamp(gainPercent / 100, 0, 1) }))
  }

  const saveMix = async () => {
    if (mixRevisionInput === null || mixFingerprint === null || saveStatus === "saving") return
    const submittedFingerprint = mixFingerprint
    setSaveStatus("saving")
    try {
      const revision = await onSaveMix(mixRevisionInput)
      setSavedFingerprint(submittedFingerprint)
      setSavedRevision(revision)
      setSaveStatus("saved")
    } catch {
      setSaveStatus("failed")
    }
  }

  const saveLabel = matchesSavedRevision
    ? "Mix saved"
    : saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "failed"
        ? "Retry save"
        : savedFingerprint !== null
          ? "Save new revision"
          : "Save mix"

  return (
    <section className={styles.mixer} aria-label="Stem mixer">
      <div className={styles.transport}>
        <button className={styles.playButton} type="button" aria-label={playing || starting ? "Pause stem mix" : "Play stem mix"} onClick={() => { void togglePlayback() }}>
          {playing || starting ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <div className={styles.transportCopy}>
          <strong>{starting ? "Opening audio…" : playing ? "Auditioning mix" : "Mix preview"}</strong>
          <span>{stems.length} tracks · synchronized from this Version</span>
        </div>
        <span className={styles.transportTime}>{formatDuration(positionSeconds)} <i>/</i> {formatDuration(durationSeconds)}</span>
      </div>

      <label className={styles.masterSeek}>
        <span className={styles.srOnly}>Seek stem mix</span>
        <input
          type="range"
          min={0}
          max={durationSeconds}
          step={0.1}
          value={Math.min(positionSeconds, durationSeconds)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek stem mix"
          style={{ background: seekBackground(positionSeconds, durationSeconds) }}
        />
      </label>

      {playbackError !== null ? <div className={styles.playbackError} role="alert">{playbackError}</div> : null}

      <div className={styles.trackList}>
        {stems.map((stem, index) => {
          const muted = mutedStemRefs.includes(stem.stem_ref)
          const solo = soloStemRef === stem.stem_ref
          const suppressedBySolo = soloStemRef !== null && !solo
          const gain = gains[stem.stem_ref] ?? 1
          return (
            <article className={`${styles.track} ${muted || suppressedBySolo ? styles.trackSuppressed : ""}`} aria-label={`${stem.label} stem`} key={stem.stem_ref}>
              <div className={styles.identity}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{stem.label}</strong><small>{stemDetail(stem)}</small></div>
              </div>
              <div className={styles.waveform}><Waveform seed={stemSeed(stem, index)} compact progress={stem.duration_seconds > 0 ? Math.min(positionSeconds / stem.duration_seconds, 1) : 0} /></div>
              <span className={styles.duration}>{formatDuration(stem.duration_seconds)}</span>
              <label className={styles.level}>
                <span>Level</span>
                <input type="range" min={0} max={100} step={1} value={Math.round(gain * 100)} aria-label={`Volume ${stem.label}`} onChange={(event) => setGain(stem.stem_ref, Number(event.target.value))} />
                <output>{Math.round(gain * 100)}</output>
              </label>
              <div className={styles.trackActions}>
                <button type="button" aria-pressed={muted} aria-label={`${muted ? "Unmute" : "Mute"} ${stem.label}`} title={`${muted ? "Unmute" : "Mute"} ${stem.label}`} onClick={() => toggleMute(stem.stem_ref)}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
                <button className={solo ? styles.soloActive : ""} type="button" aria-pressed={solo} aria-label={`${solo ? "Unsolo" : "Solo"} ${stem.label}`} onClick={() => setSoloStemRef(solo ? null : stem.stem_ref)}>S</button>
                <a href={buildMoriAssetContentUrl(stem.audio_asset_ref, "attachment")} download aria-label={`Download ${stem.label} stem`} title={`Download ${stem.label} stem`}><Download size={14} /></a>
              </div>
            </article>
          )
        })}
      </div>
      <div className={styles.savePanel}>
        <label className={styles.mixName}>
          <span>Mix name</span>
          <input value={mixName} maxLength={120} aria-label="Mix name" onChange={(event) => setMixName(event.target.value)} />
        </label>
        <div className={styles.saveCopy}>
          <strong>Keep this balance</strong>
          <span>Gain and mute are saved as a new immutable Mix Revision. Solo is preview-only.</span>
        </div>
        <button
          className={styles.saveButton}
          type="button"
          aria-label={saveLabel}
          disabled={saveStatus === "saving" || !mixChanged || mixRevisionInput === null}
          onClick={() => { void saveMix() }}
        >
          {matchesSavedRevision ? <Check size={13} /> : <Save size={13} />}
          {saveLabel}
        </button>
      </div>
      <div className={styles.saveFeedback} aria-live="polite">
        {matchesSavedRevision && savedRevision !== null ? <span><Check size={12} /> Mix revision {savedRevision.revision} saved</span> : null}
        {saveStatus === "failed" && mixChanged ? <span className={styles.saveError}>Mix was not saved. Your levels and mutes are still here.</span> : null}
      </div>
      <p className={styles.mixNote}>Non-destructive · Saving creates a Mix Revision; the Current Version and source stems stay unchanged.</p>
    </section>
  )
}

function buildMixRevisionInput(sourceStemSeparationRef: string, name: string, mix: readonly StemMixTrack[]): MixRevisionInput | null {
  try {
    return createMixRevisionRequest({
      sourceStemSeparationRef,
      name,
      tracks: mix.map((track) => ({
        stemRef: track.stemRef,
        gain: track.gain,
        muted: track.muted,
      })),
    })
  } catch {
    return null
  }
}

function initialGains(stems: readonly MoriStem[]): Record<string, number> {
  return Object.fromEntries(stems.map((stem) => [stem.stem_ref, 1]))
}

function stemDetail(stem: MoriStem): string {
  switch (stem.kind) {
    case "vocals": return "Primary vocal layer"
    case "backing_vocals": return "Harmony and support"
    case "instrumental": return "Music without vocals"
    case "drums": return "Percussion and transients"
    case "bass": return "Low-frequency foundation"
    case "guitar": return "Guitar layers"
    case "keys": return "Piano and keyboard layers"
    case "strings": return "String ensemble layers"
    case "wind": return "Woodwind and brass layers"
    case "synth": return "Synthesizer layers"
    case "percussion": return "Additional percussion"
    case "other": return "Remaining instruments"
  }
}

function stemSeed(stem: MoriStem, index: number): number {
  return stem.stem_ref.length * 7 + index * 13
}

function formatDuration(durationSeconds: number): string {
  const safeDuration = Math.max(0, Math.floor(durationSeconds))
  return `${Math.floor(safeDuration / 60)}:${String(safeDuration % 60).padStart(2, "0")}`
}

function seekBackground(positionSeconds: number, durationSeconds: number): string {
  const progress = durationSeconds > 0 ? clamp((positionSeconds / durationSeconds) * 100, 0, 100) : 0
  return `linear-gradient(90deg, var(--mori-primary) 0 ${progress}%, rgba(109, 92, 231, 0.08) ${progress}% 100%)`
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}
