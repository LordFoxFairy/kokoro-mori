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

  useEffect(() => {
    let disposed = false
    void projectsApi.listProjects({ limit: 20 }).then((response) => {
      if (!disposed) {
        setProjects(response.data.projects.map(toDomainProject))
      }
    }).catch(() => {
      // Keep the deterministic fixture visible while the BFF is unavailable.
    })

    return () => {
      disposed = true
    }
  }, [projectsApi])

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
        {projects.length > 0 ? <>
          {projects.map((project, index) => <ProjectCard key={project.projectRef} project={project} index={index} />)}
          <button className={styles.newProjectCard} type="button" onClick={() => setCreateOpen(true)} aria-haspopup="dialog" aria-label="Create another project">
            <span className={styles.newProjectIcon}>+</span>
            <strong>Start another idea</strong>
            <span>Begin with a thought, a mood, or a reference.</span>
          </button>
        </> : <div className={styles.libraryEmpty}>
          <div className={styles.libraryEmptyIcon}><Music2 size={18} /></div>
          <strong>No projects yet</strong>
          <p>Start with a thought, a mood, or a reference. Mori will keep every direction together.</p>
          <button className={styles.ghostButton} type="button" onClick={() => setCreateOpen(true)} aria-haspopup="dialog">Start a project</button>
        </div>}
      </div>
      {createOpen ? <ProjectCreateDialog
        createProject={projectsApi.createProject}
        onClose={() => setCreateOpen(false)}
        onCreated={(project) => setProjects((items) => [toDomainProject(project, 0), ...items.filter((item) => item.projectRef !== project.project_ref)])}
      /> : null}
    </div>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <article className={styles.projectCard}>
      <div className={`${styles.projectArtwork} ${index % 3 === 1 ? styles.projectArtworkPeach : index % 3 === 2 ? styles.projectArtworkMint : styles.projectArtworkLavender}`}><span>{String(index + 1).padStart(2, "0")}</span></div>
      <div className={styles.projectCardBody}>
        <div className={styles.projectCardMeta}><span>{project.candidateCount > 0 ? "Active project" : "New project"}</span><span className={styles.liveDot}>{project.candidateCount > 0 ? "● Live" : "● Ready"}</span></div>
        <h2>{project.title}</h2>
        <p>{project.description}</p>
        <div className={styles.projectCardFooter}>
          <span><Clock3 size={13} /> <strong>Last activity</strong> {project.lastActivity}</span>
          <span><strong>Current version</strong> {project.currentVersionRef ? "Ready" : "Not started"}</span>
        </div>
        <Link className={styles.projectContinue} href={`/projects/${project.projectRef}`}>
          Continue creating <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  )
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
