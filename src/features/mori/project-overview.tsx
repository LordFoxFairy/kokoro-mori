"use client"

import { ArrowLeft, ArrowUpRight, AudioLines, AudioWaveform, FileText, Play, SlidersHorizontal, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriCandidate, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, Project } from "./domain"
import { listAllMoriCandidates } from "./candidate-pagination"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewProject } from "./preview-data"
import { useProjectCurrentVersionCommit } from "./project-current-version"
import { ProjectOverviewDirections, type CandidateProjectionStatus } from "./project-overview-directions"
import { ProjectOverviewSongPlan } from "./project-overview-song-plan"
import { previewCurrentSongPlanRevision } from "./project-overview-song-plan-preview"
import { useProjectWorkspaceProjection } from "./use-project-workspace-projection"
import styles from "./mori-workspace.module.css"

type ProjectOverviewPageContentProps = {
  projectRef?: string
  api?: Pick<MoriApi, "getProject" | "listCandidates"> & Partial<Pick<MoriApi, "getProjectWorkspace" | "putCurrentVersion">>
}

export function ProjectOverviewPageContent({ projectRef = previewProject.projectRef, api }: ProjectOverviewPageContentProps = {}) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
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
    status: (initialProjectRef === previewProject.projectRef ? "ready" : "loading") as CandidateProjectionStatus,
  }))
  const [candidateRequestVersion, setCandidateRequestVersion] = useState(0)
  const requestedProject = projectState.projectRef === initialProjectRef ? projectState.value : createUnavailableProject(initialProjectRef)
  const currentCandidateState = candidateState.projectRef === initialProjectRef
    ? candidateState
    : { projectRef: initialProjectRef, value: [], status: "loading" as const }
  const candidates = currentCandidateState.value
  const candidateStatus = currentCandidateState.status
  const workspaceProjection = useProjectWorkspaceProjection(
    initialProjectRef,
    initialProjectRef === previewProject.projectRef ? undefined : overviewApi.getProjectWorkspace,
  )
  const songPlan = workspaceProjection.projection?.current_song_plan
    ?? (initialProjectRef === previewProject.projectRef ? previewCurrentSongPlanRevision : null)
  const songPlanStatus = initialProjectRef === previewProject.projectRef ? "ready" : workspaceProjection.status
  const currentCandidate = requestedProject.currentVersionRef === null
    ? undefined
    : candidates.find((candidate) => candidate.versionRef === requestedProject.currentVersionRef)
  const studioBaseHref = requestedProject.currentVersionRef === null
    ? null
    : `/projects/${encodeURIComponent(requestedProject.projectRef)}/studio/${encodeURIComponent(requestedProject.currentVersionRef)}`
  const {
    currentVersionCommitRun,
    currentVersionConfirmationEpochsRef,
    commitCurrentVersion,
    retryCurrentVersionCommit,
    dismissCurrentVersionCommit,
  } = useProjectCurrentVersionCommit({
    projectRef: initialProjectRef,
    currentVersionRef: requestedProject.currentVersionRef,
    candidates,
    putCurrentVersion: overviewApi.putCurrentVersion,
    onConfirmed: (candidate) => {
      setProjectState((current) => current.projectRef === initialProjectRef
        ? { ...current, value: { ...current.value, currentVersionRef: candidate.versionRef } }
        : current)
      setCandidateState((current) => current.projectRef === initialProjectRef
        ? { ...current, value: current.value.map((item) => ({ ...item, isCurrent: item.versionRef === candidate.versionRef })) }
        : current)
    },
  })

  useEffect(() => {
    const requestedProjectRef = projectRef.trim() || previewProject.projectRef
    const currentVersionConfirmationEpoch = currentVersionConfirmationEpochsRef.current.get(requestedProjectRef) ?? 0
    let disposed = false

    void overviewApi.getProject(requestedProjectRef).then((projectResponse) => {
      if (disposed) return
      const nextProject = toDomainProject(projectResponse.data)
      setProjectState((current) => {
        if (current.projectRef !== requestedProjectRef) return current
        return {
          projectRef: requestedProjectRef,
          value: (currentVersionConfirmationEpochsRef.current.get(requestedProjectRef) ?? 0) === currentVersionConfirmationEpoch
            ? nextProject
            : { ...nextProject, currentVersionRef: current.value.currentVersionRef },
        }
      })
    }).catch(() => {
      // Keep the deterministic preview or neutral project shell visible while the BFF is unavailable.
    })

    void listAllMoriCandidates(overviewApi, requestedProjectRef).then((candidates) => {
      if (disposed) return
      const nextCandidates = candidates.map(toDomainCandidate)
      setCandidateState({ projectRef: requestedProjectRef, value: nextCandidates, status: "ready" })
    }).catch(() => {
      if (!disposed && requestedProjectRef !== previewProject.projectRef) {
        setCandidateState({ projectRef: requestedProjectRef, value: [], status: "unavailable" })
      }
      // Never attach preview candidates to a live project when its projection is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [candidateRequestVersion, currentVersionConfirmationEpochsRef, overviewApi, projectRef])

  function playCandidate(candidate: (typeof previewCandidates)[number]) {
    if (playerCandidate?.versionRef === candidate.versionRef) {
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
        <ProjectOverviewDirections
          projectRef={requestedProject.projectRef}
          candidateCount={requestedProject.candidateCount}
          candidates={candidates}
          candidateStatus={candidateStatus}
          currentVersionRef={requestedProject.currentVersionRef}
          currentVersionCommitRun={currentVersionCommitRun}
          playerCandidate={playerCandidate}
          playing={playing}
          onPlayCandidate={playCandidate}
          onCommitCurrentVersion={commitCurrentVersion}
          onRetryCurrentVersion={retryCurrentVersionCommit}
          onDismissCurrentVersion={dismissCurrentVersionCommit}
          onRetryCandidates={() => {
            setCandidateState({ projectRef: initialProjectRef, value: [], status: "loading" })
            setCandidateRequestVersion((version) => version + 1)
          }}
        />

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

      <ProjectOverviewSongPlan
        projectRef={requestedProject.projectRef}
        plan={songPlan}
        isPreview={initialProjectRef === previewProject.projectRef}
        status={songPlanStatus}
        onRetry={workspaceProjection.retry}
      />
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
