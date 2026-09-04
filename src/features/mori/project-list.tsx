"use client"

import { ArrowUpRight, Clock3, Music2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Project } from "./domain"
import { previewProject } from "./preview-data"
import { ProjectCreateDialog } from "./project-create-dialog"
import styles from "./mori-workspace.module.css"

type ProjectsPageContentProps = {
  api?: Pick<MoriApi, "listProjects"> & Partial<Pick<MoriApi, "createProject">>
}

export function ProjectsPageContent({ api }: ProjectsPageContentProps = {}) {
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const projectsApi = api ?? defaultApi
  const [projects, setProjects] = useState<Project[]>([previewProject])
  const [createOpen, setCreateOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)

  useEffect(() => {
    let disposed = false
    void projectsApi.listProjects({ limit: 20 }).then((response) => {
      if (!disposed) {
        setProjects(response.data.projects.map(toDomainProject))
        setNextCursor(response.data.next_cursor)
        setLoadMoreError(false)
      }
    }).catch(() => {
      // Keep the deterministic fixture visible while the BFF is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [projectsApi])

  async function loadMoreProjects() {
    if (loadingMore || nextCursor === null) return

    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const response = await projectsApi.listProjects({ limit: 20, cursor: nextCursor })
      setProjects((items) => {
        const seenProjectRefs = new Set(items.map((item) => item.projectRef))
        const additions = response.data.projects
          .filter((project) => !seenProjectRefs.has(project.project_ref))
          .map((project, index) => toDomainProject(project, items.length + index))
        return [...items, ...additions]
      })
      setNextCursor(response.data.next_cursor)
    } catch {
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className={styles.catalogContent}>
      <div className={styles.catalogIntro}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Your body of work</div>
          <h1 className={styles.catalogTitle}>Projects</h1>
          <p className={styles.catalogDescription}>Keep every direction, version, and little spark connected.</p>
        </div>
        <button className={styles.generateButton} type="button" onClick={() => setCreateOpen(true)} aria-haspopup="dialog" aria-expanded={createOpen}><Music2 size={15} /> New project</button>
      </div>
      <div className={styles.projectGrid}>
        {projects.length > 0 ? projects.map((project, index) => <ProjectCard key={project.projectRef} project={project} index={index} />) : <div className={styles.libraryEmpty}>
          <div className={styles.libraryEmptyIcon}><Music2 size={18} /></div>
          <strong>No projects yet</strong>
          <p>Start with a thought, a mood, or a reference. Mori will keep every direction together.</p>
          <button className={styles.ghostButton} type="button" onClick={() => setCreateOpen(true)} aria-haspopup="dialog">Start a project</button>
        </div>}
      </div>
      {nextCursor !== null ? <div>
        <button className={styles.ghostButton} type="button" disabled={loadingMore} aria-busy={loadingMore} onClick={() => void loadMoreProjects()}>
          {loadingMore ? "Loading more projects…" : "Load more projects"}
        </button>
        {loadingMore ? <span role="status" aria-live="polite">Loading more projects…</span> : null}
        {loadMoreError ? <span role="status">
          The next page could not load.
          <button type="button" onClick={() => void loadMoreProjects()}>Try again</button>
        </span> : null}
      </div> : null}
      {createOpen ? <ProjectCreateDialog
        createProject={projectsApi.createProject}
        onClose={() => setCreateOpen(false)}
        onCreated={(project) => setProjects((items) => [toDomainProject(project, 0), ...items.filter((item) => item.projectRef !== project.project_ref)])}
      /> : null}
    </div>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const continuation = projectContinuation(project)
  const projectState = project.currentVersionRef !== null
    ? { label: "Active project", signal: "● Current", currentVersion: "Confirmed" }
    : project.candidateCount > 0
      ? { label: "Directions ready", signal: "● Review", currentVersion: "Awaiting choice" }
      : { label: "New project", signal: "● Ready", currentVersion: "Not started" }

  return (
    <Link className={styles.projectCard} href={continuation.href} aria-label={continuation.ariaLabel}>
      <div className={`${styles.projectArtwork} ${index % 3 === 1 ? styles.projectArtworkPeach : index % 3 === 2 ? styles.projectArtworkMint : styles.projectArtworkLavender}`}><span>{String(index + 1).padStart(2, "0")}</span></div>
      <div className={styles.projectCardBody}>
        <div className={styles.projectCardMeta}><span>{projectState.label}</span><span className={styles.liveDot}>{projectState.signal}</span></div>
        <h2>{project.title}</h2>
        <p>{project.description}</p>
        <div className={styles.projectCardFooter}>
          <span><Clock3 size={13} /> <strong>Last activity</strong> {project.lastActivity}</span>
          <span><strong>Current version</strong> {projectState.currentVersion}</span>
        </div>
        <span className={styles.projectContinue}>
          {continuation.label} <ArrowUpRight size={14} />
        </span>
      </div>
    </Link>
  )
}

function projectContinuation(project: Project): { href: string; label: string; ariaLabel: string } {
  if (project.currentVersionRef !== null) {
    return {
      href: `/projects/${encodeURIComponent(project.projectRef)}/studio/${encodeURIComponent(project.currentVersionRef)}`,
      label: "Continue in Studio",
      ariaLabel: `Continue ${project.title} in Studio`,
    }
  }
  if (project.candidateCount > 0) {
    return {
      href: `/projects/${encodeURIComponent(project.projectRef)}`,
      label: "Review directions",
      ariaLabel: `Review directions for ${project.title}`,
    }
  }
  return {
    href: `/create?project_ref=${encodeURIComponent(project.projectRef)}`,
    label: "Create first direction",
    ariaLabel: `Create first direction for ${project.title}`,
  }
}

function toDomainProject(project: MoriProject, index: number): Project {
  return {
    projectRef: project.project_ref,
    title: project.title,
    description: project.description,
    coverAccent: index % 3 === 1 ? "peach" : index % 3 === 2 ? "mint" : "lavender",
    currentVersionRef: project.current_version_ref,
    candidateCount: project.candidate_count,
    lastActivity: formatActivity(project.last_activity_at),
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
