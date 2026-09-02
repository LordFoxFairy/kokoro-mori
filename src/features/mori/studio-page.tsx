"use client"

import { ArrowLeft, Download, MoreHorizontal, PanelLeft, Play, Share2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import type { MoriApi } from "@/lib/mori-api"
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
  api?: Pick<MoriApi, "createExport">
}

export function StudioPageContent({ candidate, api }: StudioPageContentProps) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const studioApi = api ?? defaultApi
  const [activeTool, setActiveTool] = useState<StudioTool>("arrangement")
  const [shareFeedback, setShareFeedback] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<"idle" | "queued" | "failed">("idle")

  const preview = () => {
    if (playerCandidate.versionRef === candidate.versionRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }

  const share = () => {
    const clipboardWrite = navigator.clipboard?.writeText(window.location.href)
    if (clipboardWrite !== undefined) void clipboardWrite.catch(() => undefined)
    setShareFeedback(true)
    window.setTimeout(() => setShareFeedback(false), 1800)
  }

  const exportVersion = async () => {
    setExportFeedback("queued")
    try {
      await studioApi.createExport(candidate.versionRef, "mp3", `mori-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    } catch {
      setExportFeedback("failed")
    }
  }

  return (
    <MoriStudioShell candidate={candidate}>
      <header className={styles.studioHeader}>
        <div className={styles.studioHeaderLeft}><Link className={styles.studioBack} href={`/projects/${previewProject.projectRef}`}><ArrowLeft size={15} /> {previewProject.title}</Link><span>/</span><strong>Studio</strong></div>
        <div className={styles.studioHeaderActions}>
          <button className={styles.ghostButton} type="button" onClick={share}><Share2 size={14} /> {shareFeedback ? "Link copied" : "Share"}</button>
          <button className={styles.ghostButton} type="button" onClick={() => { void exportVersion() }} disabled={exportFeedback === "queued"}>{exportFeedback === "queued" ? "Export queued" : exportFeedback === "failed" ? "Retry export" : <><Download size={14} /> Export</>}</button>
          <button className={styles.iconButton} type="button" aria-label="More Studio options"><MoreHorizontal size={16} /></button>
        </div>
      </header>
      <div className={styles.studioLayout}>
        <aside className={styles.studioSidebar} aria-label="Studio tools">
          <div className={styles.studioArtwork}><span>01</span></div>
          <div className={styles.studioSidebarCopy}><span>Current version</span><h1>{candidate.title}</h1><p>{candidate.subtitle}</p></div>
          <div className={styles.studioToolList}>
            <button className={activeTool === "arrangement" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "arrangement"} onClick={() => setActiveTool("arrangement")}><PanelLeft size={15} /> Arrangement</button>
            <button className={activeTool === "lyrics" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "lyrics"} onClick={() => setActiveTool("lyrics")}><Sparkles size={15} /> Lyrics</button>
            <button className={activeTool === "stems" ? styles.studioToolActive : ""} type="button" aria-pressed={activeTool === "stems"} onClick={() => setActiveTool("stems")}><PanelLeft size={15} /> Stems</button>
          </div>
          <div className={styles.studioSidebarBottom}><span>Version</span><strong>{candidate.versionRef}</strong></div>
        </aside>
        <section className={styles.studioCanvas} aria-label="Studio editor">
          <div className={styles.studioCanvasTop}><div><span className={styles.eyebrow}><span className={styles.eyebrowDot} />Editing with intention</span><h2>Shape the feeling.</h2></div><button className={styles.generateButton} type="button" onClick={preview}><Play size={14} fill="currentColor" /> {playerCandidate.versionRef === candidate.versionRef && playing ? "Pause" : "Preview"}</button></div>
          {activeTool === "arrangement" ? <ArrangementEditor candidate={candidate} /> : null}
          {activeTool === "lyrics" ? <LyricsEditor /> : null}
          {activeTool === "stems" ? <StemsEditor /> : null}
        </section>
        <aside className={styles.versionRail} aria-label="Version history"><div className={styles.versionRailHeader}><div><span>Project history</span><h2>Versions</h2></div><button className={styles.iconButton} type="button" aria-label="More version options"><MoreHorizontal size={16} /></button></div>{previewCandidates.map((item, index) => <Link className={`${styles.versionItem} ${item.versionRef === candidate.versionRef ? styles.versionItemActive : ""}`} href={`/projects/${previewProject.projectRef}/studio/${item.versionRef}`} key={item.versionRef}><div className={`${styles.versionThumb} ${index === 1 ? styles.versionThumbAlt : ""}`}><Play size={12} fill="currentColor" /></div><div><strong>{item.title}</strong><span>{index === 0 ? "Current" : "Draft"} · {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span></div></Link>)}</aside>
      </div>
    </MoriStudioShell>
  )
}

function ArrangementEditor({ candidate }: { candidate: Candidate }) {
  return (
    <section aria-label="Arrangement editor">
      <div className={styles.timelineCard}>
        <div className={styles.timelineHeader}><span>Arrangement</span><span>0:36 / {Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span></div>
        <div className={styles.timelineRuler}><span>0:00</span><span>0:45</span><span>1:30</span><span>2:15</span><span>3:00</span></div>
        <div className={styles.timelineWave}><Waveform seed={candidate.waveformSeed} progress={0.2} /></div>
        <div className={styles.timelineSegments}>{previewSongPlan.structure.map((item, index) => <div className={`${styles.timelineSegment} ${index === 3 ? styles.timelineSegmentAccent : ""}`} key={item} style={{ flex: index === 0 || index === 4 ? 0.75 : index === 3 ? 1.3 : 1 }}>{item}</div>)}</div>
      </div>
      <LyricsCard />
    </section>
  )
}

function LyricsCard() {
  return <div className={styles.lyricsCard}><div className={styles.lyricsHeader}><div><span>Lyrics</span><strong>Draft 01</strong></div><button className={styles.ghostButton} type="button">Edit lyrics</button></div><p>We were headlights in the quiet<br />finding a little gold in the blue<br /><em>and every road became a reason<br />to carry the morning through</em></p></div>
}

function LyricsEditor() {
  return <section className={styles.editorPlaceholder} aria-label="Lyrics editor"><div className={styles.editorPlaceholderIcon}><Sparkles size={18} /></div><h3>Lyrics draft</h3><p>Keep the words close to the arrangement while the song finds its voice.</p><LyricsCard /></section>
}

function StemsEditor() {
  return <section className={styles.editorPlaceholder} aria-label="Stems editor"><div className={styles.editorPlaceholderIcon}><PanelLeft size={18} /></div><h3>Stems are ready to shape</h3><p>Separate vocal, harmony, rhythm, and texture layers will live here.</p><div className={styles.stemList}><span>Lead vocal <b>Preview only</b></span><span>Harmony <b>Preview only</b></span><span>Rhythm <b>Preview only</b></span></div></section>
}
