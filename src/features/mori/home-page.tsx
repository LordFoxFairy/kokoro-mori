"use client"

import { ArrowRight, Clock3, Music2, Play, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriCandidate, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, Project } from "./domain"
import { listAllMoriCandidates } from "./candidate-pagination"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewProject } from "./preview-data"
import { Waveform } from "./components/waveform"
import styles from "./mori-workspace.module.css"

type HomePageContentProps = {
  api?: Pick<MoriApi, "listProjects" | "listCandidates">
}

type DirectionProjectionStatus = "ready" | "loading" | "unavailable"

export function HomePageContent({ api }: HomePageContentProps = {}) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const homeApi = api ?? defaultApi
  const [featuredProject, setFeaturedProject] = useState<Project | null>(previewProject)
  const [candidates, setCandidates] = useState<Candidate[]>(previewCandidates)
  const [directionStatus, setDirectionStatus] = useState<DirectionProjectionStatus>("ready")

  useEffect(() => {
    let disposed = false

    void homeApi.listProjects({ limit: 1 }).then(async (response) => {
      if (disposed) return
      const project = response.data.projects[0]
      if (project === undefined) {
        setFeaturedProject(null)
        setCandidates([])
        setDirectionStatus("ready")
        return
      }

      const nextProject = toDomainProject(project)
      setFeaturedProject(nextProject)
      setCandidates([])
      setDirectionStatus("loading")

      try {
        const candidateResponse = await listAllMoriCandidates(homeApi, project.project_ref)
        if (disposed) return
        const nextCandidates = candidateResponse
          .filter((candidate) => candidate.project_ref === project.project_ref)
          .map((candidate, index) => toDomainCandidate(candidate, index, project.current_version_ref))
        setCandidates(nextCandidates)
        setDirectionStatus("ready")
      } catch {
        if (disposed) return
        setCandidates([])
        setDirectionStatus("unavailable")
      }
    }).catch(() => {
      // Keep the deterministic preview visible while the project projection is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [homeApi])

  function playCandidate(candidate: Candidate) {
    if (playerCandidate?.candidateRef === candidate.candidateRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }

  const currentCandidate = featuredProject?.currentVersionRef === null || featuredProject === null
    ? undefined
    : candidates.find((candidate) => candidate.versionRef === featuredProject.currentVersionRef)

  return (
    <div className={`${styles.catalogContent} ${styles.homeContent}`}>
      <header className={styles.homeWelcome}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Home</div>
          <h1 className={styles.catalogTitle}>Make something<br /><em>you can feel.</em></h1>
          <p className={styles.catalogDescription}>Keep the spark moving. Start a new direction or return to the song already taking shape.</p>
        </div>
      </header>

      <form className={styles.homeQuickStart} action="/create" method="get" aria-label="Start a new song">
        <label htmlFor="mori-home-idea">
          <span className={styles.featureKicker}>Quick start</span>
          <strong>Start with an idea</strong>
        </label>
        <div className={styles.homeQuickStartInput}>
          <input
            id="mori-home-idea"
            name="idea"
            maxLength={1000}
            placeholder="A soulful piano song that opens like the first train home…"
            aria-label="Start with an idea"
          />
          <button className={styles.generateButton} type="submit">Shape this idea <ArrowRight size={15} /></button>
        </div>
        <p>Mori opens an editable Song Plan before generating any music.</p>
      </form>

      {featuredProject === null ? <section className={styles.homeStartFeature} aria-labelledby="start-heading">
        <span className={styles.homeStartMark} aria-hidden="true"><Music2 size={24} /></span>
        <div>
          <span className={styles.featureKicker}>Your first Project</span>
          <h2 id="start-heading">Start with one sentence.</h2>
          <p>Mori will turn the idea into an editable Song Plan before making any Versions.</p>
        </div>
        <Link className={styles.projectContinue} href="/create">Start creating <ArrowRight size={14} /></Link>
      </section> : <section className={styles.homeFeature} aria-labelledby="continue-heading">
        <div className={styles.homeFeatureArtwork}><span>01</span><div className={styles.homeFeatureOrb} /></div>
        <div className={styles.homeFeatureCopy}>
          <span className={styles.featureKicker}>{currentCandidate === undefined ? "Continue where you left off" : "Continue Current Version"}</span>
          <h2 id="continue-heading">{featuredProject.title}</h2>
          <p>{featuredProject.description}</p>
          <div className={styles.homeFeatureMeta}><span><Clock3 size={13} /> {featuredProject.lastActivity}</span><span>{featuredProject.candidateCount} directions</span></div>
          {currentCandidate === undefined
            ? <Link className={styles.projectContinue} href={`/projects/${featuredProject.projectRef}`}>Open project <ArrowRight size={14} /></Link>
            : <Link className={styles.projectContinue} href={`/projects/${featuredProject.projectRef}/studio/${currentCandidate.versionRef}`}>Continue in Studio <ArrowRight size={14} /></Link>}
        </div>
      </section>}

      <section className={styles.homeSection} aria-labelledby="directions-heading">
        <div className={styles.homeSectionHeader}><div><span className={styles.featureKicker}>Listen back</span><h2 id="directions-heading">Your latest directions</h2></div><Link href="/library">View library <ArrowRight size={13} /></Link></div>
        <HomeDirections
          project={featuredProject}
          candidates={candidates}
          status={directionStatus}
          playerCandidateRef={playerCandidate?.candidateRef ?? null}
          playing={playing}
          onPlay={playCandidate}
        />
      </section>
    </div>
  )
}

function HomeDirections({ project, candidates, status, playerCandidateRef, playing, onPlay }: {
  project: Project | null
  candidates: Candidate[]
  status: DirectionProjectionStatus
  playerCandidateRef: string | null
  playing: boolean
  onPlay: (candidate: Candidate) => void
}) {
  if (status === "loading") {
    return <div className={styles.homeDirectionsState} role="status"><span className={styles.homeDirectionsPulse} aria-hidden="true" /><div><strong>Loading recent directions</strong><span>Keeping this Project and its Versions together…</span></div></div>
  }

  if (status === "unavailable" && project !== null) {
    return <div className={styles.homeDirectionsState} role="status"><span className={styles.homeDirectionsStateIcon} aria-hidden="true"><Music2 size={16} /></span><div><strong>Directions are temporarily unavailable</strong><span>The Project is safe. Open it to continue from its confirmed state.</span></div><Link href={`/projects/${project.projectRef}`} aria-label={`Open ${project.title}`}>Open project <ArrowRight size={13} /></Link></div>
  }

  if (candidates.length === 0) {
    const href = project === null ? "/create" : `/create?project_ref=${encodeURIComponent(project.projectRef)}`
    return <div className={styles.homeDirectionsState}><span className={styles.homeDirectionsStateIcon} aria-hidden="true"><Sparkles size={16} /></span><div><strong>No directions yet</strong><span>Make a first Version, then compare and continue it here.</span></div><Link href={href}>Create a direction <ArrowRight size={13} /></Link></div>
  }

  const projectRef = project?.projectRef ?? previewProject.projectRef
  return <div className={styles.homeTrackList}>
    {candidates.map((candidate, index) => {
      const isPlaying = playerCandidateRef === candidate.candidateRef && playing
      return <article className={styles.homeTrack} key={candidate.candidateRef}>
        <button className={`${styles.homeTrackArtwork} ${index === 1 ? styles.homeTrackArtworkAlt : ""}`} type="button" onClick={() => onPlay(candidate)} aria-label={`${isPlaying ? "Pause" : "Play"} ${candidate.title}`}><Play size={14} fill={isPlaying ? "currentColor" : "none"} /></button>
        <div className={styles.homeTrackCopy}><strong>{candidate.title}</strong><span>{candidate.subtitle}</span></div>
        <div className={styles.homeTrackWave}><Waveform seed={candidate.waveformSeed} compact progress={index === 0 ? 0.62 : 0.28} /></div>
        <span className={styles.homeTrackDuration}>{Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span>
        <Link className={styles.homeTrackOpen} href={`/projects/${projectRef}/studio/${candidate.versionRef}`} aria-label={`Open Studio for ${candidate.title}`}><ArrowRight size={14} /></Link>
      </article>
    })}
  </div>
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

function toDomainCandidate(candidate: MoriCandidate, index: number, currentVersionRef: string | null): Candidate {
  const tags = candidate.style_tags.length > 0 ? candidate.style_tags : ["new direction"]
  return {
    candidateRef: candidate.candidate_ref,
    versionRef: candidate.version_ref,
    generationRef: candidate.generation_ref,
    title: candidate.title,
    subtitle: tags.join(" · "),
    durationSeconds: candidate.duration_seconds,
    mood: tags[0] ?? "new direction",
    waveformSeed: index + 17,
    isCurrent: candidate.version_ref === currentVersionRef,
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
