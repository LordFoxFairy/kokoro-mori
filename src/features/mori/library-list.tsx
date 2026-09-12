"use client"

import { ArrowUpRight, CircleAlert, Headphones, Music2, Pause, Play, Search, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoriApi, MoriCreativeSource, MoriLibraryItem, MoriProject } from "@/lib/mori-api"
import { createMoriApiClient } from "@/lib/mori-api-client"
import type { Candidate, LibraryItem, Project } from "./domain"
import { creativeSourceKindLabel, previewCreativeSources, type MoriCreativeLibrarySource } from "./creative-assets"
import { CreativeSourceLibrary, type CreativeSourceFilter } from "./components/creative-source-library"
import paginationStyles from "./components/creative-source-library.module.css"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewLibrary, previewProject } from "./preview-data"
import styles from "./mori-workspace.module.css"

const filters = ["All", "Versions", "Sources"] as const
type LibraryFilter = (typeof filters)[number]
type ProjectionStatus = "loading" | "ready" | "unavailable" | "preview" | "omitted"

const emptyCopy: Record<LibraryFilter, { title: string; description: string }> = {
  All: {
    title: "Your library is ready",
    description: "Start a direction and keep the versions, lyrics, and exports you want to return to.",
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
  api?: Pick<MoriApi, "listLibrary"> & Partial<Pick<MoriApi, "listCreativeSources" | "listProjects">>
}

export function LibraryPageContent({ api }: LibraryPageContentProps = {}) {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
  const defaultApi = useMemo(() => createMoriApiClient(), [])
  const libraryApi = api ?? defaultApi
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(previewLibrary)
  const [libraryItemRefs, setLibraryItemRefs] = useState<string[]>([])
  const [librarySources, setLibrarySources] = useState<readonly MoriCreativeLibrarySource[]>(previewCreativeSources)
  const [libraryStatus, setLibraryStatus] = useState<ProjectionStatus>("loading")
  const [libraryCursor, setLibraryCursor] = useState<string | null>(null)
  const [libraryPageLoading, setLibraryPageLoading] = useState(false)
  const [libraryPageError, setLibraryPageError] = useState(false)
  const [sourceStatus, setSourceStatus] = useState<ProjectionStatus>("loading")
  const [sourceCursor, setSourceCursor] = useState<string | null>(null)
  const [sourcePageLoading, setSourcePageLoading] = useState(false)
  const [sourcePageError, setSourcePageError] = useState(false)
  const [projects, setProjects] = useState<Project[]>([previewProject])
  const [projectStatus, setProjectStatus] = useState<ProjectionStatus>("loading")
  const [filter, setFilter] = useState<LibraryFilter>("All")
  const [sourceFilter, setSourceFilter] = useState<CreativeSourceFilter>("All sources")
  const [query, setQuery] = useState("")

  useEffect(() => {
    let disposed = false
    const listProjects = libraryApi.listProjects
    const listCreativeSources = libraryApi.listCreativeSources
    const projectRequest = listProjects === undefined
      ? Promise.resolve(null)
      : listProjects({ limit: 20 })
    const sourceRequest = listCreativeSources === undefined
      ? Promise.resolve(null)
      : listCreativeSources({ limit: 20 })

    void Promise.allSettled([
      libraryApi.listLibrary("all"),
      projectRequest,
      sourceRequest,
    ]).then(([libraryResult, projectResult, sourceResult]) => {
      if (disposed) return

      const libraryReady = libraryResult.status === "fulfilled"
      const projectResponse = projectResult.status === "fulfilled" ? projectResult.value : null
      const projectsReady = projectResponse !== null
      const sourceResponse = sourceResult.status === "fulfilled" ? sourceResult.value : null
      const sourcesReady = sourceResponse !== null
      if (!libraryReady && !projectsReady && !sourcesReady) {
        setLibraryStatus("preview")
        setProjectStatus(listProjects === undefined ? "omitted" : "preview")
        setSourceStatus(listCreativeSources === undefined ? "omitted" : "preview")
        return
      }

      if (libraryReady) {
        const initialItems = uniqueLibraryItems(libraryResult.value.data.items, new Set(), new Set())
        setLibraryItems(toDomainLibrary(initialItems))
        setLibraryItemRefs(initialItems.map((item) => item.library_item_ref))
        setLibraryCursor(libraryResult.value.data.next_cursor)
        setLibraryPageError(false)
      } else {
        setLibraryItems([])
        setLibraryItemRefs([])
        setLibraryCursor(null)
      }
      if (sourcesReady) {
        setLibrarySources(sourceResponse.data.sources.map(toCreativeSource))
        setSourceCursor(sourceResponse.data.next_cursor)
        setSourcePageError(false)
      } else if (listCreativeSources !== undefined) {
        setLibrarySources([])
        setSourceCursor(null)
      }
      setLibraryStatus(libraryReady ? "ready" : "unavailable")
      setProjects(projectsReady ? projectResponse.data.projects.map(toDomainProject) : [])
      setProjectStatus(listProjects === undefined ? "omitted" : projectsReady ? "ready" : "unavailable")
      setSourceStatus(listCreativeSources === undefined ? "omitted" : sourcesReady ? "ready" : "unavailable")
    })

    return () => {
      disposed = true
    }
  }, [libraryApi])

  const currentVersionByProject = new Map(projects.map((project) => [project.projectRef, project.currentVersionRef]))
  const versionItems = libraryItems
    .filter((item): item is Extract<LibraryItem, { kind: "version" }> => item.kind === "version")
    .map((item) => currentVersionByProject.get(item.projectRef) === item.ref
      ? { ...item, subtitle: item.subtitle.replace(/^Version/u, "Current version") }
      : item)
  const normalizedQuery = query.trim().toLowerCase()
  const hasQuery = normalizedQuery.length > 0
  const visibleVersions = versionItems.filter((item) => {
    const matchesFilter = filter === "All" || filter === "Versions"
    if (!matchesFilter) return false
    if (!hasQuery) return true
    return `${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedQuery)
  })
  const visibleSources = librarySources.filter((source) => {
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
  const resultCount = visibleVersions.length + visibleSources.length
  const showsVersions = filter === "All" || filter === "Versions"
  const showsSources = filter === "All" || filter === "Sources"
  const unavailableKinds = [
    showsVersions && libraryStatus === "unavailable" ? "Versions" : null,
    showsVersions && projectStatus === "unavailable" ? "Current Version labels" : null,
    showsSources && sourceStatus === "unavailable" ? "Creative sources" : null,
  ].filter((value): value is string => value !== null)
  const availabilityMessage = unavailableKinds.length === 0
    ? null
    : `${unavailableKinds.join(" and ")} are temporarily unavailable. The work that loaded successfully is still shown.`
  const unavailableEmpty = filter === "Versions" && libraryStatus === "unavailable"
    ? { title: "Versions are temporarily unavailable", description: "Creative sources are still available from their own shelf." }
    : filter === "Sources" && sourceStatus === "unavailable"
      ? { title: "Creative sources are temporarily unavailable", description: "Saved Versions are still available from their own shelf." }
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
  const hasMoreVersions = showsVersions && libraryStatus === "ready" && libraryCursor !== null
  const showVersionShelf = visibleVersions.length > 0 || hasMoreVersions
  const hasMoreSources = showsSources && sourceStatus === "ready" && sourceCursor !== null
  const showSourceShelf = visibleSources.length > 0 || hasMoreSources
  const showResultSurface = resultCount > 0 || showVersionShelf || showSourceShelf

  async function loadMoreSources() {
    const listCreativeSources = libraryApi.listCreativeSources
    const cursor = sourceCursor
    if (listCreativeSources === undefined || cursor === null || sourcePageLoading) return

    setSourcePageLoading(true)
    setSourcePageError(false)
    try {
      const response = await listCreativeSources({ limit: 20, cursor })
      const nextSources = response.data.sources.map(toCreativeSource)
      setLibrarySources((current) => {
        const existing = new Set(current.map((source) => `${source.sourceKind}:${source.ref}`))
        return [...current, ...nextSources.filter((source) => !existing.has(`${source.sourceKind}:${source.ref}`))]
      })
      setSourceCursor(response.data.next_cursor)
    } catch {
      setSourcePageError(true)
    } finally {
      setSourcePageLoading(false)
    }
  }

  async function loadMoreVersions() {
    const cursor = libraryCursor
    if (cursor === null || libraryPageLoading) return

    setLibraryPageLoading(true)
    setLibraryPageError(false)
    try {
      const response = await libraryApi.listLibrary({ kind: "all", limit: 20, cursor })
      const existingVersionRefs = new Set(libraryItems
        .filter((item): item is Extract<LibraryItem, { kind: "version" }> => item.kind === "version")
        .map((item) => item.ref))
      const nextItems = uniqueLibraryItems(response.data.items, new Set(libraryItemRefs), existingVersionRefs)
      setLibraryItems((current) => [...current, ...toDomainLibrary(nextItems, current.length)])
      setLibraryItemRefs((current) => [...current, ...nextItems.map((item) => item.library_item_ref)])
      setLibraryCursor(response.data.next_cursor)
    } catch {
      setLibraryPageError(true)
    } finally {
      setLibraryPageLoading(false)
    }
  }

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
          <p className={styles.catalogDescription}>Saved music and reusable creative sources, ready for the next move.</p>
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
      {showResultSurface ? (
        <div className={styles.libraryResults} id="mori-library-results">
          {showVersionShelf ? (
            <section className={styles.librarySection} aria-label="Saved versions">
              <header className={styles.librarySectionHeader}>
                <div>
                  <h2>{filter === "All" ? "Recent versions" : "Versions"}</h2>
                  <p>Listen here, then open the Version in its Project to keep shaping it.</p>
                </div>
                <span>{visibleVersions.length} {visibleVersions.length === 1 ? "version" : "versions"}</span>
              </header>
              <div className={styles.libraryList}>
                {visibleVersions.map((item) => {
                  const versionPath = `/projects/${encodeURIComponent(item.projectRef)}/studio/${encodeURIComponent(item.ref)}`
                  const active = playerCandidate?.versionRef === item.ref
                  return (
                    <article className={styles.libraryRow} key={item.ref}>
                      <div className={`${styles.libraryArtwork} ${item.accent === "peach" ? styles.libraryArtworkPeach : item.accent === "mint" ? styles.libraryArtworkMint : ""}`}>
                        <Music2 size={18} />
                      </div>
                      <div className={styles.libraryCopy}>
                        <strong>{item.title}</strong>
                        <span>{item.subtitle}</span>
                        {item.releaseStatus === "published" ? <small>Published</small> : item.releaseStatus === "unpublished" ? <small>Unpublished</small> : item.releaseStatus === "publishing" ? <small>Publishing…</small> : null}
                      </div>
                      <span className={styles.libraryDuration}><Headphones size={13} /> {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span>
                      <div className={styles.libraryActions}>
                        <button className={styles.iconButton} type="button" onClick={() => playVersion(item.ref)} aria-label={`${active && playing ? "Pause" : "Play"} ${item.title}`}>{active && playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
                        <Link className={styles.iconButton} href={versionPath} aria-label={`Open ${item.title} studio`}><ArrowUpRight size={14} /></Link>
                        {item.releaseStatus === "published" && item.publicUrl !== null && item.publicUrl !== undefined ? <a className={styles.iconButton} href={item.publicUrl} aria-label={`Open public release ${item.title}`}><ArrowUpRight size={14} /></a> : null}
                      </div>
                    </article>
                  )
                })}
              </div>
              {hasMoreVersions ? (
                <div className={paginationStyles.pagination}>
                  <button
                    className={paginationStyles.paginationButton}
                    type="button"
                    disabled={libraryPageLoading}
                    aria-busy={libraryPageLoading}
                    onClick={() => void loadMoreVersions()}
                  >
                    {libraryPageLoading ? "Loading more versions…" : "Load more versions"}
                  </button>
                  {libraryPageLoading ? (
                    <span role="status" aria-live="polite" aria-label="Library versions pagination">Loading more versions…</span>
                  ) : null}
                  {libraryPageError ? (
                    <span className={paginationStyles.paginationError} role="status" aria-label="Library versions pagination">
                      The next versions page could not load.
                      <button className={paginationStyles.paginationRetry} type="button" onClick={() => void loadMoreVersions()}>Try again</button>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
          {showSourceShelf ? (
            <CreativeSourceLibrary
              sources={visibleSources}
              filter={sourceFilter}
              showFilters={filter === "Sources"}
              onFilterChange={setSourceFilter}
              onBrowseAll={() => {
                setSourceFilter("All sources")
                setFilter("Sources")
              }}
              nextCursor={sourceCursor}
              loadingMore={sourcePageLoading}
              loadMoreError={sourcePageError}
              onLoadMore={loadMoreSources}
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

function uniqueLibraryItems(items: MoriLibraryItem[], existingLibraryItemRefs: ReadonlySet<string>, existingVersionRefs: ReadonlySet<string>): MoriLibraryItem[] {
  const seenLibraryItemRefs = new Set(existingLibraryItemRefs)
  const seenVersionRefs = new Set(existingVersionRefs)
  return items.filter((item) => {
    if (seenLibraryItemRefs.has(item.library_item_ref) || seenVersionRefs.has(item.version_ref)) return false
    seenLibraryItemRefs.add(item.library_item_ref)
    seenVersionRefs.add(item.version_ref)
    return true
  })
}

function toDomainLibrary(items: MoriLibraryItem[], startIndex = 0): LibraryItem[] {
  return [
    ...items.filter((item): item is Extract<MoriLibraryItem, { kind: "version" }> => item.kind === "version").map((item, index) => ({
      kind: "version" as const,
      ref: item.version_ref,
      projectRef: item.project_ref,
      title: item.title,
      subtitle: `Version · ${item.project_title}`,
      durationSeconds: item.duration_seconds,
      accent: (startIndex + index) % 2 === 0 ? "lavender" as const : "peach" as const,
      audioAssetRef: item.audio_asset_ref,
      waveformAssetRef: item.waveform_asset_ref,
      ...(item.release_status === undefined ? {} : { releaseStatus: item.release_status }),
      ...(item.public_url === undefined ? {} : { publicUrl: item.public_url }),
    })),
  ]
}

function toCreativeSource(source: MoriCreativeSource): MoriCreativeLibrarySource {
  if (source.source_kind === "audio") {
    return { sourceKind: "audio", ref: source.source_ref, assetRef: source.asset_ref, name: source.name, description: source.description, durationSeconds: source.duration_seconds }
  }
  if (source.source_kind === "voice") {
    return { sourceKind: "voice", ref: source.source_ref, name: source.name, description: source.description }
  }
  return { sourceKind: "inspiration", ref: source.source_ref, name: source.name, description: source.description, style: source.style }
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
    audioAssetRef: item.audioAssetRef,
  }
}
