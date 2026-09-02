"use client"

import { ArrowUpRight, Download, FolderKanban, Headphones, Music2, Pause, Play, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriLibraryItem, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, LibraryItem, Project } from "./domain"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewLibrary, previewProject } from "./preview-data"
import styles from "./mori-workspace.module.css"

const filters = ["All", "Projects", "Versions", "Lyrics", "Exports"] as const
type LibraryFilter = (typeof filters)[number]

const emptyCopy: Record<LibraryFilter, { title: string; description: string }> = {
  All: {
    title: "Your library is ready",
    description: "Start a direction and keep the versions, lyrics, and exports you want to return to.",
  },
  Projects: {
    title: "No projects yet",
    description: "Start a project from a thought, a mood, or a reference.",
  },
  Versions: {
    title: "No versions yet",
    description: "Generate a direction and keep the version you want to return to.",
  },
  Lyrics: {
    title: "No lyrics saved yet",
    description: "Start with a lyric idea and keep the words alongside the music.",
  },
  Exports: {
    title: "No exports yet",
    description: "Your mastered downloads will appear here when they are ready.",
  },
}

type LibraryPageContentProps = {
  api?: Pick<MoriApi, "listLibrary"> & Partial<Pick<MoriApi, "listProjects">>
}

export function LibraryPageContent({ api }: LibraryPageContentProps = {}) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const libraryApi = api ?? defaultApi
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(previewLibrary)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [filter, setFilter] = useState<LibraryFilter>("All")

  useEffect(() => {
    let disposed = false
    void libraryApi.listLibrary("all").then((response) => {
      if (!disposed) setLibraryItems(toDomainLibrary(response.data.items))
    }).catch(() => {
      // Keep the deterministic fixture visible while the BFF is unavailable.
    })

    const listProjects = libraryApi.listProjects
    if (listProjects !== undefined) {
      void listProjects({ limit: 20 }).then((response) => {
        if (!disposed) setProjects(response.data.projects.map(toDomainProject))
      }).catch(() => {
        // Keep the deterministic project card visible while the BFF is unavailable.
      })
    }

    return () => {
      disposed = true
    }
  }, [libraryApi])

  const itemsWithProjects = projects === null
    ? libraryItems
    : [...projects.map(toLibraryProject), ...libraryItems.filter((item) => item.kind === "version")]
  const items = itemsWithProjects.filter((item) => {
    if (filter === "All") return true
    if (filter === "Projects") return item.kind === "project"
    if (filter === "Versions") return item.kind === "version"
    return false
  })

  const playVersion = (versionRef: string) => {
    const libraryItem = libraryItems.find((item): item is Extract<LibraryItem, { kind: "version" }> => item.kind === "version" && item.ref === versionRef)
    const candidate = previewCandidates.find((item) => item.versionRef === versionRef) ?? (libraryItem ? toPlayerCandidate(libraryItem) : null)
    if (!candidate) return
    if (playerCandidate?.versionRef === candidate.versionRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }

  return (
    <div className={styles.catalogContent}>
      <div className={styles.catalogIntro}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Everything you make</div>
          <h1 className={styles.catalogTitle}>Library</h1>
          <p className={styles.catalogDescription}>A calm shelf for the pieces you want to return to.</p>
        </div>
        <button className={styles.ghostButton} type="button" onClick={() => setFilter("Exports")}><Download size={14} /> Export center</button>
      </div>
      <div className={styles.filterBar} aria-label="Library filters">
        {filters.map((item) => <button className={`${styles.filterButton} ${filter === item ? styles.filterButtonActive : ""}`} type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      {items.length > 0 ? (
        <div className={styles.libraryList}>
          {items.map((item) => {
            const isProject = item.kind === "project"
            const versionPath = isProject ? `/projects/${item.ref}` : `/projects/${item.projectRef}/studio/${item.ref}`
            const active = !isProject && playerCandidate?.versionRef === item.ref
            return (
              <article className={styles.libraryRow} key={item.ref}>
                <div className={`${styles.libraryArtwork} ${item.accent === "peach" ? styles.libraryArtworkPeach : item.accent === "mint" ? styles.libraryArtworkMint : ""}`}>
                  {isProject ? <FolderKanban size={18} /> : <Music2 size={18} />}
                </div>
                <div className={styles.libraryCopy}>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
                {!isProject ? <span className={styles.libraryDuration}><Headphones size={13} /> {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span> : null}
                <div className={styles.libraryActions}>
                  {!isProject ? <button className={styles.iconButton} type="button" onClick={() => playVersion(item.ref)} aria-label={`${active && playing ? "Pause" : "Play"} ${item.title}`}>{active && playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button> : null}
                  <Link className={styles.iconButton} href={versionPath} aria-label={`Open ${item.title} ${isProject ? "project" : "studio"}`}><ArrowUpRight size={14} /></Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className={styles.libraryEmpty}>
          <div className={styles.libraryEmptyIcon}><Sparkles size={18} /></div>
          <strong>{emptyCopy[filter].title}</strong>
          <p>{emptyCopy[filter].description}</p>
          <Link className={styles.ghostButton} href="/create"><Sparkles size={14} /> Start creating</Link>
        </div>
      )}
    </div>
  )
}

function toDomainLibrary(items: MoriLibraryItem[]): LibraryItem[] {
  return [
    ...items.map((item, index) => ({
      kind: "version" as const,
      ref: item.version_ref,
      projectRef: item.project_ref,
      title: item.title,
      subtitle: item.version_ref === previewProject.currentVersionRef
        ? `Current version · ${item.project_title}`
        : `Version · ${item.project_title}`,
      durationSeconds: item.duration_seconds,
      accent: index % 2 === 0 ? "lavender" as const : "peach" as const,
    })),
  ]
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

function toLibraryProject(project: Project): Extract<LibraryItem, { kind: "project" }> {
  return {
    kind: "project",
    ref: project.projectRef,
    title: project.title,
    subtitle: `${project.candidateCount} ${project.candidateCount === 1 ? "version" : "versions"} · Updated ${project.lastActivity.toLowerCase()}`,
    accent: project.coverAccent,
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

function toPlayerCandidate(item: Extract<LibraryItem, { kind: "version" }>): Candidate {
  return {
    candidateRef: `candidate_${item.ref}`,
    versionRef: item.ref,
    generationRef: `generation_${item.projectRef}`,
    title: item.title,
    subtitle: "Saved version",
    durationSeconds: item.durationSeconds,
    mood: "Saved",
    waveformSeed: item.ref.length,
    isCurrent: item.ref === previewProject.currentVersionRef,
  }
}
