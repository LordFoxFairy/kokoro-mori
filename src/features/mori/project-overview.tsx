"use client"

import { ArrowLeft, ArrowUpRight, AudioLines, AudioWaveform, FileText, Play, SlidersHorizontal, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriCandidate, MoriProject, MoriProjectWorkspaceActiveTask } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, Project } from "./domain"
import { listAllMoriCandidates } from "./candidate-pagination"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewGeneration, previewProject } from "./preview-data"
import { useProjectCurrentVersionCommit } from "./project-current-version"
import { ProjectOverviewDirections, type CandidateProjectionStatus, type ProjectProjectionStatus } from "./project-overview-directions"
import { ProjectOverviewSongPlan } from "./project-overview-song-plan"
import { previewCurrentSongPlanRevision } from "./project-overview-song-plan-preview"
import { useProjectWorkspaceProjection } from "./use-project-workspace-projection"
import styles from "./mori-workspace.module.css"

type ProjectOverviewPageContentProps = {
  projectRef?: string
  generationRef?: string
  api?: Pick<MoriApi, "getProject" | "listCandidates"> & Partial<Pick<MoriApi, "getProjectWorkspace" | "putCurrentVersion">>
}

export function ProjectOverviewPageContent({ projectRef = previewProject.projectRef, generationRef, api }: ProjectOverviewPageContentProps = {}) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying, setProjectContext, clearProjectContext } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const overviewApi = api ?? defaultApi
  const initialProjectRef = projectRef.trim() || previewProject.projectRef
  const initialGenerationRef = generationRef?.trim() || null
  const usesPreviewCandidates = initialProjectRef === previewProject.projectRef
    && (initialGenerationRef === null || initialGenerationRef === previewGeneration.generationRef)
  const [projectState, setProjectState] = useState(() => ({
    projectRef: initialProjectRef,
    value: initialProjectRef === previewProject.projectRef ? previewProject : createUnavailableProject(initialProjectRef),
  }))
  const [projectStatus, setProjectStatus] = useState<ProjectProjectionStatus>(() => initialProjectRef === previewProject.projectRef ? "ready" : "loading")
  const [projectRequestVersion, setProjectRequestVersion] = useState(0)
  const [candidateState, setCandidateState] = useState(() => ({
    projectRef: initialProjectRef,
    generationRef: initialGenerationRef,
    value: usesPreviewCandidates ? previewCandidates : [],
    status: (usesPreviewCandidates ? "ready" : initialProjectRef === previewProject.projectRef ? "unavailable" : "loading") as CandidateProjectionStatus,
  }))
  const [candidateRequestVersion, setCandidateRequestVersion] = useState(0)
  const requestedProject = projectState.projectRef === initialProjectRef ? projectState.value : createUnavailableProject(initialProjectRef)
  const currentCandidateState = candidateState.projectRef === initialProjectRef && candidateState.generationRef === initialGenerationRef
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
  const activeTasks = workspaceProjection.projection?.active_tasks ?? []

  useEffect(() => {
    if (projectStatus !== "ready") return
    setProjectContext({
      projectRef: initialProjectRef,
      title: requestedProject.title,
      meta: requestedProject.candidateCount > 0 ? `${requestedProject.candidateCount} directions` : null,
    })
    return () => clearProjectContext(initialProjectRef)
  }, [clearProjectContext, initialProjectRef, projectStatus, requestedProject.candidateCount, requestedProject.title, setProjectContext])
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
      setCandidateState((current) => current.projectRef === initialProjectRef && current.generationRef === initialGenerationRef
        ? { ...current, value: current.value.map((item) => ({ ...item, isCurrent: item.versionRef === candidate.versionRef })) }
        : current)
    },
  })

  useEffect(() => {
    const requestedProjectRef = initialProjectRef
    const currentVersionConfirmationEpoch = currentVersionConfirmationEpochsRef.current.get(requestedProjectRef) ?? 0
    let disposed = false

    if (usesPreviewCandidates) {
      return () => {
        disposed = true
      }
    }

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
      setProjectStatus("ready")
    }).catch(() => {
      if (!disposed) setProjectStatus("unavailable")
    })

    return () => {
      disposed = true
    }
  }, [currentVersionConfirmationEpochsRef, initialProjectRef, overviewApi, projectRequestVersion, usesPreviewCandidates])

  useEffect(() => {
    const requestedProjectRef = initialProjectRef
    let disposed = false

    if (usesPreviewCandidates) {
      return () => {
        disposed = true
      }
    }

    void listAllMoriCandidates(overviewApi, requestedProjectRef, initialGenerationRef ?? undefined).then((candidates) => {
      if (disposed) return
      const scopedCandidates = initialGenerationRef === null
        ? candidates
        : candidates.filter((candidate) => candidate.generation_ref === initialGenerationRef)
      const nextCandidates = scopedCandidates.map(toDomainCandidate)
      setCandidateState({ projectRef: requestedProjectRef, generationRef: initialGenerationRef, value: nextCandidates, status: "ready" })
    }).catch(() => {
      if (!disposed) {
        setCandidateState({ projectRef: requestedProjectRef, generationRef: initialGenerationRef, value: [], status: "unavailable" })
      }
      // Never attach preview candidates to a live project when its projection is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [candidateRequestVersion, initialGenerationRef, initialProjectRef, overviewApi, usesPreviewCandidates])

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
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />{projectStatus === "loading" ? "Loading project" : projectStatus === "unavailable" ? "Project unavailable" : "Active project"}</div>
          <h1 className={styles.catalogTitle}>{requestedProject.title}</h1>
          <p>{requestedProject.description}</p>
          {projectStatus === "ready" ? <div className={styles.projectOverviewActions}>
              {studioBaseHref ? <Link className={styles.generateButton} href={studioBaseHref}><Play size={14} fill="currentColor" /> Open Studio</Link> : null}
              <Link className={styles.ghostButton} href={`/create?project_ref=${encodeURIComponent(requestedProject.projectRef)}`}><Sparkles size={14} /> New direction</Link>
            </div> : null}
          <div className={styles.overviewStats} aria-label="Project status">
            <div><span>Current version</span><strong>{projectStatus === "loading" ? "Loading…" : projectStatus === "unavailable" ? "Unavailable" : requestedProject.currentVersionRef ? (candidates.find((candidate) => candidate.versionRef === requestedProject.currentVersionRef)?.title ?? "Ready") : "Not started"}</strong></div>
            <div><span>Directions</span><strong>{projectStatus === "loading" ? "Loading…" : projectStatus === "unavailable" ? "Unavailable" : requestedProject.candidateCount}</strong></div>
            <div><span>Last activity</span><strong>{projectStatus === "loading" ? "Loading…" : projectStatus === "unavailable" ? "Unavailable" : requestedProject.lastActivity}</strong></div>
          </div>
        </div>
      </div>

      {projectStatus === "loading" ? <div className={styles.overviewProjectionState} role="status" aria-label="Project projection">
        <span className={styles.overviewProjectionStateIcon} aria-hidden="true"><AudioWaveform size={17} /></span>
        <div><strong>Loading project details</strong><p>Connecting this workspace before enabling project actions.</p></div>
      </div> : projectStatus === "unavailable" ? <div className={styles.overviewProjectionState} role="alert" aria-label="Project projection">
        <span className={styles.overviewProjectionStateIcon} aria-hidden="true"><AudioWaveform size={17} /></span>
        <div><strong>Project details unavailable</strong><p>Directions can still be auditioned, but project changes stay paused until the workspace reconnects.</p></div>
        <button type="button" onClick={() => {
          setProjectStatus("loading")
          setProjectRequestVersion((version) => version + 1)
        }} aria-label="Retry project"><span aria-hidden="true"><Sparkles size={13} /></span> Retry project</button>
      </div> : null}

      <div className={styles.projectOverviewWorkspace} role="group" aria-label="Project workspace">
        <ProjectOverviewDirections
          projectRef={requestedProject.projectRef}
          candidateCount={requestedProject.candidateCount}
          candidates={candidates}
          generationRef={initialGenerationRef}
          candidateStatus={candidateStatus}
          projectStatus={projectStatus}
          currentVersionRef={requestedProject.currentVersionRef}
          currentVersionCommitRun={currentVersionCommitRun}
          playerCandidate={playerCandidate}
          playing={playing}
          onPlayCandidate={playCandidate}
          onCommitCurrentVersion={commitCurrentVersion}
          onRetryCurrentVersion={retryCurrentVersionCommit}
          onDismissCurrentVersion={dismissCurrentVersionCommit}
          onRetryCandidates={() => {
            setCandidateState({ projectRef: initialProjectRef, generationRef: initialGenerationRef, value: [], status: "loading" })
            setCandidateRequestVersion((version) => version + 1)
          }}
        />

        <div className={styles.projectOverviewSidebar}>
          {activeTasks.length > 0 ? <ProjectOverviewActiveTasks projectRef={requestedProject.projectRef} tasks={activeTasks} /> : null}
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

function ProjectOverviewActiveTasks({ projectRef, tasks }: { projectRef: string; tasks: readonly MoriProjectWorkspaceActiveTask[] }) {
  return <section className={`${styles.overviewSection} ${styles.continueMaking}`} aria-labelledby="active-work-heading">
    <div className={styles.overviewSectionHeader}>
      <div>
        <h2 id="active-work-heading">In progress</h2>
        <p>Pick up work that is still rendering in this Project.</p>
      </div>
      <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
    </div>
    <div className={styles.continueMakingGrid}>
      {tasks.map((task) => {
        const presentation = activeTaskPresentation(task)
        const progress = Math.max(0, Math.min(100, Math.round(task.progress)))
        return <Link className={styles.continueMakingCard} href={activeTaskHref(projectRef, task)} aria-label={`Resume ${presentation.label}`} key={task.task_ref}>
          <span className={styles.continueMakingIcon} aria-hidden="true"><presentation.Icon size={16} /></span>
          <span className={styles.continueMakingCopy}>
            <strong>{presentation.label}</strong>
            <span>{presentation.description}</span>
            <small>{task.status === "queued" ? "Queued" : `${progress}% complete`} · {presentation.destination}</small>
            <span className={styles.activeTaskProgress} role="progressbar" aria-label={`${presentation.label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </span>
          </span>
          <ArrowUpRight className={styles.continueMakingArrow} size={15} aria-hidden="true" />
        </Link>
      })}
    </div>
  </section>
}

function activeTaskPresentation(task: MoriProjectWorkspaceActiveTask): {
  label: string
  description: string
  destination: string
  Icon: typeof Sparkles
} {
  switch (task.kind) {
    case "generation": return { label: "Generate directions", description: "Compare the new takes when they are ready.", destination: "Create queue", Icon: Sparkles }
    case "lyrics_revision": return { label: "Rewrite lyrics", description: "Review lyric suggestions before applying them.", destination: "Lyrics", Icon: FileText }
    case "stem_separation": return { label: "Separate stems", description: "Open the non-destructive voice and stems workspace.", destination: "Voice & stems", Icon: AudioWaveform }
    case "artwork_generation": return { label: "Create artwork", description: "Review visual concepts for this Version.", destination: "Finish", Icon: Sparkles }
    case "export": return { label: "Render export", description: "Return to the render status and download when ready.", destination: "Export", Icon: AudioLines }
  }
}

function activeTaskHref(projectRef: string, task: MoriProjectWorkspaceActiveTask): string {
  const encodedProjectRef = encodeURIComponent(projectRef)
  if (task.kind === "generation") {
    return `/create?project_ref=${encodedProjectRef}&generation_ref=${encodeURIComponent(task.task_ref)}`
  }
  if (task.version_ref === null) return `/projects/${encodedProjectRef}`
  const surface = task.kind === "lyrics_revision" ? "lyrics" : task.kind === "stem_separation" ? "stems" : "finish"
  return `/projects/${encodedProjectRef}/studio/${encodeURIComponent(task.version_ref)}?surface=${surface}`
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
