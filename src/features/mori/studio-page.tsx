"use client"

import { ArrowLeft, AudioLines, AudioWaveform, Check, Download, FileText, Play, Save, Share2, Sparkles, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriCandidate, MoriExportSnapshot } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate } from "./domain"
import { MoriStudioShell } from "./components/mori-studio-shell"
import { useMoriApp } from "./components/mori-app-provider"
import { Waveform } from "./components/waveform"
import { previewCandidates, previewProject, previewSongPlan } from "./preview-data"
import styles from "./mori-workspace.module.css"

type StudioTool = "arrangement" | "lyrics" | "stems"

type StudioPageContentProps = {
  candidate: Candidate
  projectRef?: string
  versionRef?: string
  api?: Pick<MoriApi, "createExport"> & Partial<Pick<MoriApi, "getExport" | "getProject" | "listCandidates">>
}

export function StudioPageContent({ candidate, projectRef, versionRef, api }: StudioPageContentProps) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const studioApi = api ?? defaultApi
  const initialCandidate = resolveInitialCandidate(candidate, projectRef, versionRef)
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(() => initialCandidate)
  const [studioCandidates, setStudioCandidates] = useState(() => initialCandidate === null ? [] : [initialCandidate, ...previewCandidates.filter((item) => item.versionRef !== initialCandidate.versionRef)])
  const [currentVersionRef, setCurrentVersionRef] = useState(() => previewCandidates.find((item) => item.isCurrent)?.versionRef ?? candidate.versionRef)
  const [projectTitle, setProjectTitle] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<StudioTool>("arrangement")
  const [shareFeedback, setShareFeedback] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<"idle" | "queued" | "processing" | "succeeded" | "failed">("idle")
  const [exportRef, setExportRef] = useState<string | null>(null)
  const [exportSnapshot, setExportSnapshot] = useState<MoriExportSnapshot | null>(null)

  useEffect(() => {
    const requestedProjectRef = projectRef?.trim()
    if (!requestedProjectRef) return

    const getProject = studioApi.getProject
    const listCandidates = studioApi.listCandidates
    let disposed = false

    if (getProject) {
      void getProject(requestedProjectRef).then((response) => {
        if (!disposed) setProjectTitle(response.data.title)
      }).catch(() => {
        // Keep the deterministic project title visible while the BFF is unavailable.
      })
    }

    if (listCandidates) {
      void listCandidates(requestedProjectRef).then((response) => {
        if (disposed) return
        const nextCandidates = response.data.candidates.map(toDomainCandidate)
        const requestedVersionRef = versionRef?.trim()
        const nextActiveCandidate = requestedVersionRef
          ? nextCandidates.find((item) => item.versionRef === requestedVersionRef)
          : nextCandidates[0]
        setStudioCandidates(nextCandidates)
        setActiveCandidate(nextActiveCandidate ?? null)
        setCurrentVersionRef(nextCandidates.find((item) => item.isCurrent)?.versionRef ?? nextActiveCandidate?.versionRef ?? "")
      }).catch(() => {
        if (initialCandidate === null) {
          setStudioCandidates([])
          setActiveCandidate(null)
          setCurrentVersionRef("")
        }
        // Keep the deterministic fixture visible for the known preview route.
      })
    }

    return () => {
      disposed = true
    }
  }, [initialCandidate, projectRef, studioApi, versionRef])

  const preview = () => {
    if (activeCandidate === null) return
    if (playerCandidate?.versionRef === activeCandidate.versionRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(activeCandidate)
    setPlaying(true)
  }

  const selectTake = (take: Candidate) => {
    setActiveCandidate(take)
  }

  const previewTake = (take: Candidate) => {
    if (playerCandidate?.versionRef === take.versionRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(take)
    setPlaying(true)
  }

  const promoteTake = (take: Candidate) => {
    setCurrentVersionRef(take.versionRef)
    setActiveCandidate(take)
  }

  const share = () => {
    const clipboardWrite = navigator.clipboard?.writeText(window.location.href)
    if (clipboardWrite !== undefined) void clipboardWrite.catch(() => undefined)
    setShareFeedback(true)
    window.setTimeout(() => setShareFeedback(false), 1800)
  }

  const exportVersion = async () => {
    if (activeCandidate === null) return
    setExportFeedback("queued")
    setExportRef(null)
    setExportSnapshot(null)
    try {
      const response = await studioApi.createExport(activeCandidate.versionRef, "mp3", `mori-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      setExportRef(response.data.export_ref)
      setExportFeedback(response.data.status === "processing" ? "processing" : "queued")
    } catch {
      setExportFeedback("failed")
    }
  }

  useEffect(() => {
    const getExport = studioApi.getExport
    if (exportRef === null || getExport === undefined) return
    let disposed = false
    let timer: number | undefined

    const syncExport = async () => {
      try {
        const response = await getExport(exportRef)
        if (disposed) return
        setExportSnapshot(response.data)
        if (response.data.status === "succeeded") {
          setExportFeedback("succeeded")
          return
        }
        if (response.data.status === "failed") {
          setExportFeedback("failed")
          return
        }
        setExportFeedback(response.data.status)
        timer = window.setTimeout(() => { void syncExport() }, 220)
      } catch {
        if (!disposed) setExportFeedback("failed")
      }
    }

    void syncExport()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [exportRef, studioApi])

  const downloadUrl = exportSnapshot?.download_url
  const exportReady = exportFeedback === "succeeded" && typeof downloadUrl === "string"
  const exportLabel = exportFeedback === "queued"
    ? "Export queued"
    : exportFeedback === "processing"
      ? "Exporting…"
      : exportFeedback === "failed"
        ? "Retry export"
        : "Export"

  const activeProjectRef = projectRef?.trim() || previewProject.projectRef
  const activeProjectTitle = projectTitle ?? (activeProjectRef === previewProject.projectRef ? previewProject.title : "Project")

  return (
    <MoriStudioShell candidate={activeCandidate} playerCandidates={studioCandidates}>
      <header className={styles.studioHeader}>
          <div className={styles.studioHeaderLeft}><Link className={styles.studioBack} href={`/projects/${activeProjectRef}`}><ArrowLeft size={15} /> {activeProjectTitle}</Link><span>/</span><strong>Studio</strong></div>
          <div className={styles.studioHeaderActions}>
            <button className={styles.ghostButton} type="button" onClick={share}><Share2 size={14} /> {shareFeedback ? "Link copied" : "Share"}</button>
          {activeCandidate !== null ? exportReady ? <a className={styles.ghostButton} href={downloadUrl} download aria-label={`Download ${exportSnapshot?.format.toUpperCase() ?? "MP3"}`}><Download size={14} /> Download {exportSnapshot?.format.toUpperCase() ?? "MP3"}</a> : <button className={styles.ghostButton} type="button" onClick={() => { void exportVersion() }} disabled={exportFeedback === "queued" || exportFeedback === "processing"}>{exportFeedback === "queued" || exportFeedback === "processing" ? exportLabel : exportFeedback === "failed" ? "Retry export" : <><Download size={14} /> Export</>}</button> : null}
        </div>
      </header>
      {activeCandidate === null ? <section className={styles.studioUnavailable} aria-label="Studio version unavailable">
        <div className={styles.studioUnavailableIcon}><Sparkles size={20} /></div>
        <h1>This version is not available yet</h1>
        <p>Mori could not find a playable version for this project. Return to the project and choose another direction.</p>
        <Link className={styles.generateButton} href={`/projects/${activeProjectRef}`}><ArrowLeft size={14} /> Back to projects</Link>
      </section> : <div className={styles.studioLayout}>
        <aside className={styles.studioSidebar} aria-label="Studio tools">
          <div className={styles.studioArtwork}><span>01</span></div>
          <div className={styles.studioSidebarCopy}><span>Current version</span><h1>{activeCandidate.title}</h1><p>{activeCandidate.subtitle}</p></div>
          <div className={styles.studioToolList}>
            <button className={activeTool === "arrangement" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "arrangement"} onClick={() => setActiveTool("arrangement")}><AudioLines size={15} /> Arrangement</button>
            <button className={activeTool === "lyrics" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "lyrics"} onClick={() => setActiveTool("lyrics")}><FileText size={15} /> Lyrics</button>
            <button className={activeTool === "stems" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "stems"} onClick={() => setActiveTool("stems")}><AudioWaveform size={15} /> Stems</button>
          </div>
          <div className={styles.studioSidebarBottom}><span>Version</span><strong>{activeCandidate.versionRef}</strong></div>
        </aside>
        <section className={styles.studioCanvas} aria-label="Studio editor">
          <div className={styles.studioCanvasTop}><div><span className={styles.eyebrow}><span className={styles.eyebrowDot} />Editing with intention</span><h2>Shape the feeling.</h2></div><button className={styles.generateButton} type="button" onClick={preview}><Play size={14} fill="currentColor" /> {playerCandidate?.versionRef === activeCandidate.versionRef && playing ? "Pause" : "Preview"}</button></div>
          {activeTool === "arrangement" ? <ArrangementEditor candidate={activeCandidate} takes={studioCandidates} currentVersionRef={currentVersionRef} playerVersionRef={playerCandidate?.versionRef ?? ""} playing={playing} onSelectTake={selectTake} onPreviewTake={previewTake} onPromoteTake={promoteTake} /> : null}
          {activeTool === "lyrics" ? <LyricsEditor key={activeCandidate.versionRef} versionRef={activeCandidate.versionRef} /> : null}
          {activeTool === "stems" ? <StemsEditor /> : null}
        </section>
        <aside className={styles.versionRail} aria-label="Version history"><div className={styles.versionRailHeader}><div><span>Project history</span><h2>Versions</h2></div></div>{studioCandidates.map((item, index) => <Link className={`${styles.versionItem} ${item.versionRef === activeCandidate.versionRef ? styles.versionItemActive : ""}`} href={`/projects/${activeProjectRef}/studio/${item.versionRef}`} key={item.versionRef}><div className={`${styles.versionThumb} ${index === 1 ? styles.versionThumbAlt : ""}`}><Play size={12} fill="currentColor" /></div><div><strong>{item.title}</strong><span>{index === 0 ? "Current" : "Draft"} · {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span></div></Link>)}</aside>
      </div>}
    </MoriStudioShell>
  )
}

function resolveInitialCandidate(candidate: Candidate, projectRef?: string, versionRef?: string): Candidate | null {
  const requestedProjectRef = projectRef?.trim()
  const requestedVersionRef = versionRef?.trim()
  if (requestedProjectRef !== undefined && requestedProjectRef !== "" && requestedProjectRef !== previewProject.projectRef) return null
  if (requestedVersionRef !== undefined && requestedVersionRef !== "" && requestedVersionRef !== candidate.versionRef) return null
  return candidate
}

function toDomainCandidate(candidate: MoriCandidate, index: number): Candidate {
  const tags = candidate.style_tags.length > 0 ? candidate.style_tags : ["new direction"]
  return {
    candidateRef: candidate.candidate_ref,
    versionRef: candidate.version_ref,
    generationRef: candidate.generation_ref,
    title: candidate.title,
    subtitle: tags.join(" · "),
    durationSeconds: candidate.duration_seconds,
    mood: tags[0] ?? "new direction",
    waveformSeed: index + 13,
    isCurrent: index === 0,
  }
}

type ArrangementEditorProps = {
  candidate: Candidate
  takes: Candidate[]
  currentVersionRef: string
  playerVersionRef: string
  playing: boolean
  onSelectTake: (take: Candidate) => void
  onPreviewTake: (take: Candidate) => void
  onPromoteTake: (take: Candidate) => void
}

function ArrangementEditor({ candidate, takes, currentVersionRef, playerVersionRef, playing, onSelectTake, onPreviewTake, onPromoteTake }: ArrangementEditorProps) {
  return (
    <section aria-label="Arrangement editor">
      <div className={styles.timelineCard}>
        <div className={styles.timelineHeader}><span>Arrangement</span><span>0:36 / {Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span></div>
        <div className={styles.timelineRuler}><span>0:00</span><span>0:45</span><span>1:30</span><span>2:15</span><span>3:00</span></div>
        <div className={styles.timelineWave}><Waveform seed={candidate.waveformSeed} progress={0.2} /></div>
        <div className={styles.timelineSegments}>{previewSongPlan.structure.map((item, index) => <div className={`${styles.timelineSegment} ${index === 3 ? styles.timelineSegmentAccent : ""}`} key={item} style={{ flex: index === 0 || index === 4 ? 0.75 : index === 3 ? 1.3 : 1 }}>{item}</div>)}</div>
      </div>
      <section className={styles.takeLanes} aria-label="Take lanes">
        <div className={styles.takeLanesHeader}>
          <div><span>Compare before committing</span><h3>Take lanes</h3></div>
          <span>{takes.length} {takes.length === 1 ? "take" : "takes"}</span>
        </div>
        <div className={styles.takeLaneList}>
          {takes.map((take, index) => {
            const isSelected = take.versionRef === candidate.versionRef
            const isCurrent = take.versionRef === currentVersionRef
            const isPlaying = take.versionRef === playerVersionRef && playing
            return (
              <article className={`${styles.takeLane} ${isSelected ? styles.takeLaneSelected : ""} ${isCurrent ? styles.takeLaneCurrent : ""}`} aria-label={`Take ${index + 1}: ${take.title}`} key={take.versionRef}>
                <button className={styles.takeLaneSelect} type="button" aria-pressed={isSelected} aria-label={`Select ${take.title} take`} onClick={() => onSelectTake(take)}>
                  <span className={styles.takeLaneIndex}>0{index + 1}</span>
                  <span className={styles.takeLaneCopy}><strong>{take.title}</strong><span>{take.subtitle}</span></span>
                </button>
                <div className={styles.takeLaneWave}><Waveform seed={take.waveformSeed} compact progress={isSelected ? 0.62 : 0.34} /></div>
                <span className={styles.takeLaneDuration}>{Math.floor(take.durationSeconds / 60)}:{String(take.durationSeconds % 60).padStart(2, "0")}</span>
                <div className={styles.takeLaneActions}>
                  <button className={styles.takeLanePreview} type="button" onClick={() => onPreviewTake(take)} aria-label={`${isPlaying ? "Pause" : "Preview"} ${take.title}`}><Play size={12} fill={isPlaying ? "currentColor" : "none"} /> {isPlaying ? "Pause" : "Preview"}</button>
                  {isCurrent ? <span className={styles.takeLaneCurrentLabel}>Current version</span> : <button className={styles.takeLanePromote} type="button" onClick={() => onPromoteTake(take)} aria-label={`Use ${take.title} as current`}>Use take</button>}
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <LyricsCard />
    </section>
  )
}

function LyricsCard() {
  return <div className={styles.lyricsCard}><div className={styles.lyricsHeader}><div><span>Lyrics</span><strong>Draft 01</strong></div></div><p>We were headlights in the quiet<br />finding a little gold in the blue<br /><em>and every road became a reason<br />to carry the morning through</em></p></div>
}

const defaultLyrics = "We were headlights in the quiet\nfinding a little gold in the blue\nand every road became a reason\nto carry the morning through"

function LyricsEditor({ versionRef }: { versionRef: string }) {
  const storageKey = `mori.lyrics.${versionRef}`
  const [lyrics, setLyrics] = useState(() => readStoredLyrics(storageKey) ?? defaultLyrics)
  const [saved, setSaved] = useState(true)
  const wordCount = lyrics.trim() === "" ? 0 : lyrics.trim().split(/\s+/u).length

  return (
    <section className={styles.editorSurface} aria-label="Lyrics editor">
      <header className={styles.editorSurfaceHeader}>
        <div><span>Words stay close to the take</span><h3>Lyrics draft</h3></div>
        <span className={saved ? styles.editorSaved : styles.editorUnsaved}>{saved ? "Saved locally" : "Unsaved changes"}</span>
      </header>
      <textarea className={styles.lyricsEditorArea} aria-label="Lyrics draft" value={lyrics} onChange={(event) => { setLyrics(event.target.value); setSaved(false) }} />
      <footer className={styles.editorSurfaceFooter}>
        <span>{wordCount} words · Draft 01</span>
        <button className={styles.ghostButton} type="button" disabled={saved} onClick={() => saveLyricsDraft(storageKey, lyrics, setSaved)}>{saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save draft</>}</button>
      </footer>
    </section>
  )
}

function readStoredLyrics(storageKey: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function saveLyricsDraft(storageKey: string, lyrics: string, setSaved: (saved: boolean) => void): void {
  try {
    window.localStorage.setItem(storageKey, lyrics)
    setSaved(true)
  } catch {
    setSaved(false)
  }
}

function StemsEditor() {
  const stems = [
    { name: "Lead vocal", detail: "Center · close", seed: 17 },
    { name: "Harmony", detail: "Wide · soft", seed: 23 },
    { name: "Rhythm", detail: "Room · organic", seed: 31 },
    { name: "Texture", detail: "Air · low", seed: 37 },
  ]
  const [mutedStems, setMutedStems] = useState<string[]>([])
  const [soloStem, setSoloStem] = useState<string | null>(null)

  function toggleMute(name: string) {
    setMutedStems((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  }

  return (
    <section className={styles.stemsEditor} aria-label="Stems editor">
      <header className={styles.editorSurfaceHeader}>
        <div><span>Preview mix for the current take</span><h3>Stem balance</h3></div>
        <span className={styles.stemPreviewBadge}>Preview only</span>
      </header>
      <div className={styles.stemTrackList}>
        {stems.map((stem) => {
          const muted = mutedStems.includes(stem.name)
          const solo = soloStem === stem.name
          return (
            <div className={`${styles.stemTrack} ${muted ? styles.stemTrackMuted : ""}`} key={stem.name}>
              <div className={styles.stemTrackCopy}><strong>{stem.name}</strong><span>{stem.detail}</span></div>
              <div className={styles.stemTrackWave}><Waveform seed={stem.seed} compact progress={muted ? 0.1 : solo ? 0.9 : 0.56} /></div>
              <div className={styles.stemActions}>
                <button className={styles.stemAction} type="button" aria-pressed={muted} aria-label={`${muted ? "Unmute" : "Mute"} ${stem.name}`} onClick={() => toggleMute(stem.name)}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
                <button className={`${styles.stemSolo} ${solo ? styles.stemSoloActive : ""}`} type="button" aria-pressed={solo} aria-label={`${solo ? "Unsolo" : "Solo"} ${stem.name}`} onClick={() => setSoloStem(solo ? null : stem.name)}>Solo</button>
              </div>
            </div>
          )
        })}
      </div>
      <p className={styles.stemNote}>Mute and solo are ready for the connected audio renderer.</p>
    </section>
  )
}
