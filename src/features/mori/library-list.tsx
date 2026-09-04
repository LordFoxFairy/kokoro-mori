"use client"

import { ArrowUpRight, CircleAlert, FolderKanban, Headphones, Music2, Pause, Play, Search, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriLibraryItem, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, LibraryItem, Project } from "./domain"
import { creativeSourceKindLabel, previewCreativeSources } from "./creative-assets"
import { CreativeSourceLibrary, type CreativeSourceFilter } from "./components/creative-source-library"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewLibrary, previewProject } from "./preview-data"
import styles from "./mori-workspace.module.css"

const filters = ["All", "Projects", "Versions", "Sources"] as const
type LibraryFilter = (typeof filters)[number]
type ProjectionStatus = "loading" | "ready" | "unavailable" | "preview" | "omitted"

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
  Sources: {
    title: "No creative sources yet",
    description: "Uploads, voice profiles, and inspiration presets you keep will appear here.",
  },
}

type LibraryPageContentProps = {
  api?: Pick<MoriApi, "listLibrary"> & Partial<Pick<MoriApi, "listProjects">>
}

export function LibraryPageContent({ api }: LibraryPageContentProps = {}) {
  const { playerCandidate, playing, replacePlayerCandidates, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const libraryApi = api ?? defaultApi
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(previewLibrary)
  const [libraryStatus, setLibraryStatus] = useState<ProjectionStatus>("loading")
  const [projects, setProjects] = useState<Project[]>([previewProject])
  const [projectStatus, setProjectStatus] = useState<ProjectionStatus>("loading")
  const [filter, setFilter] = useState<LibraryFilter>("All")
  const [sourceFilter, setSourceFilter] = useState<CreativeSourceFilter>("All sources")
  const [query, setQuery] = useState("")

  useEffect(() => {
    let disposed = false
    const listProjects = libraryApi.listProjects
    const projectRequest = listProjects === undefined
      ? Promise.resolve(null)
      : listProjects({ limit: 20 })

    void Promise.allSettled([
      libraryApi.listLibrary("all"),
      projectRequest,
    ]).then(([libraryResult, projectResult]) => {
      if (disposed) return

      const libraryReady = libraryResult.status === "fulfilled"
      const projectResponse = projectResult.status === "fulfilled" ? projectResult.value : null
      const projectsReady = projectResponse !== null
      if (!libraryReady && !projectsReady) {
        setLibraryStatus("preview")
        setProjectStatus(listProjects === undefined ? "omitted" : "preview")
        return
      }

      setLibraryItems(libraryReady ? toDomainLibrary(libraryResult.value.data.items) : [])
      setLibraryStatus(libraryReady ? "ready" : "unavailable")
      setProjects(projectsReady ? projectResponse.data.projects.map(toDomainProject) : [])
      setProjectStatus(listProjects === undefined ? "omitted" : projectsReady ? "ready" : "unavailable")
    })

    return () => {
      disposed = true
    }
  }, [libraryApi])

  const playerLibraryCandidates = useMemo(() => libraryItems
    .filter((item): item is Extract<LibraryItem, { kind: "version" }> => item.kind === "version")
    .map((item) => previewCandidates.find((candidate) => candidate.versionRef === item.ref) ?? toPlayerCandidate(item)), [libraryItems])

  useEffect(() => {
    if (libraryStatus === "ready") replacePlayerCandidates(playerLibraryCandidates)
  }, [libraryStatus, playerLibraryCandidates, replacePlayerCandidates])

  const currentVersionByProject = new Map(projects.map((project) => [project.projectRef, project.currentVersionRef]))
  const versionItems = libraryItems
    .filter((item): item is Extract<LibraryItem, { kind: "version" }> => item.kind === "version")
    .map((item) => currentVersionByProject.get(item.projectRef) === item.ref
      ? { ...item, subtitle: item.subtitle.replace(/^Version/u, "Current version") }
      : item)
  const itemsWithProjects = [...projects.map(toLibraryProject), ...versionItems]
  const normalizedQuery = query.trim().toLowerCase()
  const hasQuery = normalizedQuery.length > 0
  const visibleWorks = itemsWithProjects.filter((item) => {
    const matchesFilter = filter === "All"
      || (filter === "Projects" && item.kind === "project")
      || (filter === "Versions" && item.kind === "version")
    if (!matchesFilter) return false
    if (!hasQuery) return true
    return `${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedQuery)
  })
  const visibleSources = previewCreativeSources.filter((source) => {
    if (filter !== "All" && filter !== "Sources") return false
    const matchesSourceFilter = filter !== "Sources"
      || sourceFilter === "All sources"
      || (sourceFilter === "Audio" && source.sourceKind === "audio")
      || (sourceFilter === "Voices" && source.sourceKind === "voice")
      || (sourceFilter === "Inspiration" && source.sourceKind === "inspiration")
    if (!matchesSourceFilter) return false
    if (!hasQuery) return true
    return `${source.name} ${source.description} ${creativeSourceKindLabel(source.sourceKind)}`.toLowerCase().includes(normalizedQuery)
  })
  const resultCount = visibleWorks.length + visibleSources.length
  const unavailableKinds = [
    projectStatus === "unavailable" ? "Projects" : null,
    libraryStatus === "unavailable" ? "Versions" : null,
  ].filter((value): value is string => value !== null)
  const availabilityMessage = unavailableKinds.length === 0
    ? null
    : `${unavailableKinds.join(" and ")} are temporarily unavailable. The work that loaded successfully is still shown.`
  const unavailableEmpty = filter === "Projects" && projectStatus === "unavailable"
    ? { title: "Projects are temporarily unavailable", description: "Your versions and creative sources are still available." }
    : filter === "Versions" && libraryStatus === "unavailable"
      ? { title: "Versions are temporarily unavailable", description: "Your projects and creative sources are still available." }
      : null
  const emptyState = hasQuery
    ? {
        title: `No matches for “${query.trim()}”`,
        description: "Try another title, project, version, or creative source.",
      }
    : unavailableEmpty ?? emptyCopy[filter]
  const resultLabel = hasQuery
    ? `${resultCount} ${resultCount === 1 ? "result" : "results"}`
    : `${resultCount} ${resultCount === 1 ? "item" : "items"}`

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
      </div>
      <div className={styles.libraryToolbar}>
        <div className={styles.filterBar} aria-label="Library filters">
          {filters.map((item) => <button className={`${styles.filterButton} ${filter === item ? styles.filterButtonActive : ""}`} type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <div className={styles.librarySearchGroup}>
          <div className={styles.librarySearch}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search library"
              aria-controls="mori-library-results"
              autoComplete="off"
              placeholder="Search library"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query.length > 0 ? (
              <button className={styles.librarySearchClear} type="button" aria-label="Clear library search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            ) : null}
          </div>
          <span
            className={styles.libraryResultCount}
            role="status"
            aria-live="polite"
            aria-label={hasQuery ? `${resultLabel} for ${query.trim()}` : resultLabel}
          >
            {resultLabel}
          </span>
        </div>
      </div>
      {availabilityMessage === null ? null : (
        <div className={styles.libraryAvailability} role="status" aria-label="Library availability">
          <CircleAlert size={15} />
          <span>{availabilityMessage}</span>
        </div>
      )}
      {resultCount > 0 ? (
        <div className={styles.libraryResults} id="mori-library-results">
          {visibleWorks.length > 0 ? (
            <section className={styles.librarySection} aria-label="Projects and versions">
              <header className={styles.librarySectionHeader}>
                <div>
                  <h2>{filter === "Projects" ? "Projects" : filter === "Versions" ? "Versions" : "Projects & versions"}</h2>
                  <p>Continue from the work itself, not from a disconnected tool.</p>
                </div>
                <span>{visibleWorks.length} {visibleWorks.length === 1 ? "item" : "items"}</span>
              </header>
              <div className={styles.libraryList}>
                {visibleWorks.map((item) => {
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
            </section>
          ) : null}
          {visibleSources.length > 0 ? (
            <CreativeSourceLibrary
              sources={visibleSources}
              filter={sourceFilter}
              showFilters={filter === "Sources"}
              onFilterChange={setSourceFilter}
              onBrowseAll={() => {
                setSourceFilter("All sources")
                setFilter("Sources")
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className={styles.libraryEmpty} id="mori-library-results">
          <div className={styles.libraryEmptyIcon}><Sparkles size={18} /></div>
          <strong>{emptyState.title}</strong>
          <p>{emptyState.description}</p>
          {hasQuery ? (
            <button className={styles.ghostButton} type="button" onClick={() => setQuery("")}><X size={14} /> Clear search</button>
          ) : (
            <Link className={styles.ghostButton} href="/create"><Sparkles size={14} /> Start creating</Link>
          )}
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
      subtitle: `Version · ${item.project_title}`,
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
