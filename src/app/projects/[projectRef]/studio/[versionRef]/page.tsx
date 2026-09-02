import { ArrowLeft, Download, MoreHorizontal, PanelLeft, Play, Share2, Sparkles } from "lucide-react"
import Link from "next/link"
import { previewCandidates, previewProject, previewSongPlan } from "@/features/mori/preview-data"
import { Waveform } from "@/features/mori/components/waveform"
import { MoriStudioShell } from "@/features/mori/components/mori-studio-shell"
import styles from "@/features/mori/mori-workspace.module.css"

type StudioPageProps = { params: Promise<{ projectRef: string; versionRef: string }> }

export default async function StudioPage({ params }: StudioPageProps) {
  const { versionRef } = await params
  const candidate = previewCandidates.find((item) => item.versionRef === versionRef) ?? previewCandidates[0]

  return (
    <main className={styles.studioApp}>
      <MoriStudioShell candidate={candidate}>
          <header className={styles.studioHeader}>
            <div className={styles.studioHeaderLeft}><Link className={styles.studioBack} href={`/projects/${previewProject.projectRef}`}><ArrowLeft size={15} /> {previewProject.title}</Link><span>/</span><strong>Studio</strong></div>
            <div className={styles.studioHeaderActions}><button className={styles.ghostButton} type="button"><Share2 size={14} /> Share</button><button className={styles.ghostButton} type="button"><Download size={14} /> Export</button><button className={styles.iconButton} type="button" aria-label="More Studio options"><MoreHorizontal size={16} /></button></div>
          </header>
          <div className={styles.studioLayout}>
            <aside className={styles.studioSidebar} aria-label="Studio tools">
              <div className={styles.studioArtwork}><span>01</span></div>
              <div className={styles.studioSidebarCopy}><span>Current version</span><h1>{candidate.title}</h1><p>{candidate.subtitle}</p></div>
              <div className={styles.studioToolList}><button className={styles.studioToolActive} type="button"><PanelLeft size={15} /> Arrangement</button><button type="button"><Sparkles size={15} /> Lyrics</button><button type="button"><PanelLeft size={15} /> Stems</button></div>
              <div className={styles.studioSidebarBottom}><span>Version</span><strong>{candidate.versionRef}</strong></div>
            </aside>
            <section className={styles.studioCanvas} aria-label="Studio editor">
              <div className={styles.studioCanvasTop}><div><span className={styles.eyebrow}><span className={styles.eyebrowDot} />Editing with intention</span><h2>Shape the feeling.</h2></div><button className={styles.generateButton} type="button"><Play size={14} fill="currentColor" /> Preview</button></div>
              <div className={styles.timelineCard}>
                <div className={styles.timelineHeader}><span>Arrangement</span><span>0:36 / {Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span></div>
                <div className={styles.timelineRuler}><span>0:00</span><span>0:45</span><span>1:30</span><span>2:15</span><span>3:00</span></div>
                <div className={styles.timelineWave}><Waveform seed={candidate.waveformSeed} progress={0.2} /></div>
                <div className={styles.timelineSegments}>{previewSongPlan.structure.map((item, index) => <div className={`${styles.timelineSegment} ${index === 3 ? styles.timelineSegmentAccent : ""}`} key={item} style={{ flex: index === 0 || index === 4 ? 0.75 : index === 3 ? 1.3 : 1 }}>{item}</div>)}</div>
              </div>
              <div className={styles.lyricsCard}><div className={styles.lyricsHeader}><div><span>Lyrics</span><strong>Draft 01</strong></div><button className={styles.ghostButton} type="button">Edit lyrics</button></div><p>We were headlights in the quiet<br />finding a little gold in the blue<br /><em>and every road became a reason<br />to carry the morning through</em></p></div>
            </section>
            <aside className={styles.versionRail} aria-label="Version history"><div className={styles.versionRailHeader}><div><span>Project history</span><h2>Versions</h2></div><button className={styles.iconButton} type="button" aria-label="More version options"><MoreHorizontal size={16} /></button></div>{previewCandidates.map((item, index) => <Link className={`${styles.versionItem} ${item.versionRef === candidate.versionRef ? styles.versionItemActive : ""}`} href={`/projects/${previewProject.projectRef}/studio/${item.versionRef}`} key={item.versionRef}><div className={`${styles.versionThumb} ${index === 1 ? styles.versionThumbAlt : ""}`}><Play size={12} fill="currentColor" /></div><div><strong>{item.title}</strong><span>{index === 0 ? "Current" : "Draft"} · {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span></div></Link>)}</aside>
          </div>
      </MoriStudioShell>
    </main>
  )
}
