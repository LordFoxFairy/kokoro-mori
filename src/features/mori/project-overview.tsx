"use client"

import { ArrowLeft, ArrowUpRight, AudioLines, AudioWaveform, Clock3, FileText, Play, SlidersHorizontal, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriCandidate, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, Project } from "./domain"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewProject, previewSongPlan } from "./preview-data"
import { Waveform } from "./components/waveform"
import styles from "./mori-workspace.module.css"

type ProjectOverviewPageContentProps = {
  projectRef?: string
  api?: Pick<MoriApi, "getProject" | "listCandidates">
}

export function ProjectOverviewPageContent({ projectRef = previewProject.projectRef, api }: ProjectOverviewPageContentProps = {}) {
  const { clearPlayerCandidate, playerCandidate, playing, replacePlayerCandidates, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const overviewApi = api ?? defaultApi
  const initialProjectRef = projectRef.trim() || previewProject.projectRef
  const [projectState, setProjectState] = useState(() => ({
    projectRef: initialProjectRef,
    value: initialProjectRef === previewProject.projectRef ? previewProject : createUnavailableProject(initialProjectRef),
  }))
  const [candidateState, setCandidateState] = useState(() => ({
    projectRef: initialProjectRef,
    value: initialProjectRef === previewProject.projectRef ? previewCandidates : [],
  }))
  const requestedProject = projectState.projectRef === initialProjectRef ? projectState.value : createUnavailableProject(initialProjectRef)
  const candidates = candidateState.projectRef === initialProjectRef ? candidateState.value : []
  const hasPlanProjection = initialProjectRef === previewProject.projectRef
  const currentCandidate = requestedProject.currentVersionRef === null
    ? undefined
    : candidates.find((candidate) => candidate.versionRef === requestedProject.currentVersionRef)
  const studioBaseHref = requestedProject.currentVersionRef === null
    ? null
    : `/projects/${encodeURIComponent(requestedProject.projectRef)}/studio/${encodeURIComponent(requestedProject.currentVersionRef)}`

  useEffect(() => {
    const requestedProjectRef = projectRef.trim() || previewProject.projectRef
    let disposed = false

    void overviewApi.getProject(requestedProjectRef).then((projectResponse) => {
      if (!disposed) setProjectState({ projectRef: requestedProjectRef, value: toDomainProject(projectResponse.data) })
    }).catch(() => {
      // Keep the deterministic preview or neutral project shell visible while the BFF is unavailable.
    })

    void overviewApi.listCandidates(requestedProjectRef).then((candidatesResponse) => {
      if (disposed) return
      const nextCandidates = candidatesResponse.data.candidates.map(toDomainCandidate)
      setCandidateState({ projectRef: requestedProjectRef, value: nextCandidates })
      if (nextCandidates.length === 0) clearPlayerCandidate()
      else replacePlayerCandidates(nextCandidates)
    }).catch(() => {
      if (!disposed && requestedProjectRef !== previewProject.projectRef) clearPlayerCandidate()
      // Never attach preview candidates to a live project when its projection is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [clearPlayerCandidate, overviewApi, projectRef, replacePlayerCandidates])

  function playCandidate(candidate: (typeof previewCandidates)[number]) {
    if (playerCandidate?.candidateRef === candidate.candidateRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }

  return (
    <div className={styles.catalogContent}>
      <Link className={styles.backLink} href="/projects"><ArrowLeft size={14} /> All projects</Link>
      <div className={styles.projectOverviewHeader}>
        <div className={styles.projectOverviewArtwork}><span>01</span></div>
        <div className={styles.projectOverviewCopy}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Active project</div>
          <h1 className={styles.catalogTitle}>{requestedProject.title}</h1>
          <p>{requestedProject.description}</p>
          <div className={styles.projectOverviewActions}>
            {studioBaseHref ? <Link className={styles.generateButton} href={studioBaseHref}><Play size={14} fill="currentColor" /> Open Studio</Link> : null}
            <Link className={styles.ghostButton} href={`/create?project_ref=${encodeURIComponent(requestedProject.projectRef)}`}><Sparkles size={14} /> New direction</Link>
          </div>
          <div className={styles.overviewStats} aria-label="Project status">
            <div><span>Current version</span><strong>{requestedProject.currentVersionRef ? (candidates.find((candidate) => candidate.versionRef === requestedProject.currentVersionRef)?.title ?? "Ready") : "Not started"}</strong></div>
            <div><span>Directions</span><strong>{requestedProject.candidateCount}</strong></div>
            <div><span>Last activity</span><strong>{requestedProject.lastActivity}</strong></div>
          </div>
        </div>
      </div>

      <div className={styles.projectOverviewWorkspace} role="group" aria-label="Project workspace">
        <section className={`${styles.overviewSection} ${styles.overviewDirections}`} aria-labelledby="directions-heading">
          <div className={styles.overviewSectionHeader}>
            <div><h2 id="directions-heading">Latest directions</h2><p>Listen and compare before choosing what to change next.</p></div>
            <span>{candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}</span>
          </div>
          {candidates.length > 0 ? <div className={styles.overviewCandidateList}>
              {candidates.map((candidate, index) => {
                const isCurrent = candidate.versionRef === requestedProject.currentVersionRef
                return <article
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`${candidate.title}${isCurrent ? ", current version" : ""}`}
                  className={`${styles.overviewCandidate} ${isCurrent ? styles.overviewCandidateCurrent : ""}`}
                  key={candidate.candidateRef}
                >
                <button className={`${styles.candidateArtwork} ${styles.overviewCandidateArtwork} ${index === 1 ? styles.candidateArtworkAlt : ""}`} type="button" onClick={() => playCandidate(candidate)} aria-label={`${playerCandidate?.candidateRef === candidate.candidateRef && playing ? "Pause" : "Play"} ${candidate.title}`}>
                  <Play size={14} fill={playerCandidate?.candidateRef === candidate.candidateRef && playing ? "currentColor" : "none"} />
                </button>
                <div className={styles.overviewCandidateInfo}>
                  <div className={styles.overviewCandidateTitle}><strong>{candidate.title}</strong>{isCurrent ? <span className={styles.overviewCurrentBadge}>Current</span> : null}</div>
                  <span>{candidate.subtitle}</span>
                </div>
                <div className={styles.overviewCandidateWave}><Waveform seed={candidate.waveformSeed} compact progress={index === 0 ? 0.8 : 0.48} /></div>
                <span className={styles.candidateDuration}>{Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span>
                <Link className={styles.overviewOpenLink} href={`/projects/${requestedProject.projectRef}/studio/${candidate.versionRef}`} aria-label={`Open Studio for ${candidate.title}`}><ArrowUpRight size={15} /></Link>
              </article>
              })}
          </div> : <div className={styles.libraryEmpty}>
            <div className={styles.libraryEmptyIcon}><Sparkles size={18} /></div>
            <strong>No directions yet</strong>
            <p>Shape the first direction for this project, then compare versions here.</p>
            <Link className={styles.ghostButton} href={`/create?project_ref=${encodeURIComponent(requestedProject.projectRef)}`}>Create a direction</Link>
          </div>}
        </section>

        {studioBaseHref ? (
          <section className={`${styles.overviewSection} ${styles.continueMaking}`} aria-labelledby="continue-making-heading">
            <div className={styles.overviewSectionHeader}>
              <div>
                <h2 id="continue-making-heading">Continue making</h2>
                <p>Choose a clear task for the confirmed Current Version.</p>
              </div>
              <span>Current · {currentCandidate?.title ?? "Current Version"}</span>
            </div>
            <div className={styles.continueMakingGrid}>
              <ProjectContinuationLink
                href={`${studioBaseHref}?surface=arrangement&intent=transform`}
                label="Remix & edit"
                description="Restyle, remix, replace, or extend a section."
                destination="Arrangement"
                icon={SlidersHorizontal}
              />
              <ProjectContinuationLink
                href={`${studioBaseHref}?surface=arrangement&intent=cover`}
                label="Cover"
                description="Re-perform this Version as a vocal or instrumental take."
                destination="New takes"
                icon={AudioLines}
              />
              <ProjectContinuationLink
                href={`${studioBaseHref}?surface=lyrics`}
                label="Lyrics"
                description="Draft, rewrite, or continue with the song in view."
                destination="Review before apply"
                icon={FileText}
              />
              <ProjectContinuationLink
                href={`${studioBaseHref}?surface=stems`}
                label="Voice & stems"
                description="Add vocals, split parts, or save a mix revision."
                destination="Non-destructive"
                icon={AudioWaveform}
              />
              <ProjectContinuationLink
                href={`${studioBaseHref}?surface=finish`}
                label="Remaster & release"
                description="Polish audio or prepare artwork and release details."
                destination="No auto-publish"
                icon={SlidersHorizontal}
              />
            </div>
          </section>
        ) : null}
      </div>

      <section className={styles.overviewSection} aria-labelledby="plan-overview-heading">
        <div className={styles.overviewSectionHeader}><div><h2 id="plan-overview-heading">Song plan</h2><p>The intention behind this project, kept visible as you refine it.</p></div></div>
        {hasPlanProjection ? <div className={styles.overviewPlanCard}>
          <div className={styles.overviewPlanStats}><span><b>Mood</b>{previewSongPlan.mood}</span><span><b>Tempo</b>{previewSongPlan.tempoBpm} BPM</span><span><b>Voice</b>Intimate lead</span></div>
          <div className={styles.tagRow}>{previewSongPlan.structure.map((item) => <span className={`${styles.tag} ${styles.tagSelected}`} key={item}>{item}</span>)}</div>
          <p><Clock3 size={14} /> {previewSongPlan.vocalDirection}</p>
        </div> : <div className={styles.overviewPlanUnavailable}>
          <span className={styles.overviewPlanUnavailableIcon} aria-hidden="true"><Sparkles size={17} /></span>
          <div><strong>Plan details not available</strong><p>Start a new direction to shape an editable mood, structure, palette, and voice before generating.</p></div>
          <Link href={`/create?project_ref=${encodeURIComponent(requestedProject.projectRef)}`}>Create with a plan <ArrowUpRight size={13} /></Link>
        </div>}
      </section>
    </div>
  )
}

function ProjectContinuationLink({ href, label, description, destination, icon: Icon }: {
  href: string
  label: string
  description: string
  destination: string
  icon: typeof Sparkles
}) {
  return (
    <Link className={styles.continueMakingCard} href={href} aria-label={label}>
      <span className={styles.continueMakingIcon} aria-hidden="true"><Icon size={17} /></span>
      <span className={styles.continueMakingCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
        <small>{destination}</small>
      </span>
      <ArrowUpRight className={styles.continueMakingArrow} size={15} aria-hidden="true" />
    </Link>
  )
}

function toDomainProject(project: MoriProject): Project {
  return {
    projectRef: project.project_ref,
    title: project.title,
    description: project.description,
    coverAccent: "lavender",
    currentVersionRef: project.current_version_ref,
    candidateCount: project.candidate_count,
    lastActivity: formatActivity(project.last_activity_at),
  }
}

function createUnavailableProject(projectRef: string): Project {
  return {
    projectRef,
    title: "Project",
    description: "Project details will appear here once the workspace is connected.",
    coverAccent: "lavender",
    currentVersionRef: null,
    candidateCount: 0,
    lastActivity: "Recently updated",
  }
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
    isCurrent: false,
    audioAssetRef: candidate.audio_asset_ref,
  }
}

function formatActivity(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return "Recently updated"
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (elapsedMinutes < 1) return "Just now"
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(timestamp)
}
