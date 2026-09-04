import { ArrowUpRight, FileAudio, Mic2, Sparkles } from "lucide-react"
import Link from "next/link"
import { creativeSourceKindLabel, type MoriCreativeLibrarySource, type MoriCreativeSourceKind } from "../creative-assets"
import styles from "./creative-source-library.module.css"

const sourceFilters = ["All sources", "Audio", "Voices", "Inspiration"] as const
export type CreativeSourceFilter = (typeof sourceFilters)[number]

type CreativeSourceLibraryProps = {
  sources: readonly MoriCreativeLibrarySource[]
  filter: CreativeSourceFilter
  showFilters: boolean
  onFilterChange: (filter: CreativeSourceFilter) => void
  onBrowseAll: () => void
  nextCursor: string | null
  loadingMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
}

export function CreativeSourceLibrary({ sources, filter, showFilters, onFilterChange, onBrowseAll, nextCursor, loadingMore, loadMoreError, onLoadMore }: CreativeSourceLibraryProps) {
  return (
    <section className={styles.shelf} aria-label="Creative source library">
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h2>Creative sources</h2>
          <p>Reusable audio, voices, and starting directions stay close to every new song.</p>
        </div>
        {showFilters ? (
          <div className={styles.filterBar} aria-label="Source filters">
            {sourceFilters.map((item) => (
              <button className={styles.filterButton} type="button" key={item} aria-pressed={filter === item} onClick={() => onFilterChange(item)}>{item}</button>
            ))}
          </div>
        ) : <button className={styles.browseButton} type="button" onClick={onBrowseAll}>Browse all sources</button>}
      </header>
      <div className={styles.grid}>
        {sources.map((source) => (
          <article className={styles.card} data-source-kind={source.sourceKind} key={`${source.sourceKind}:${source.ref}`}>
            <div className={styles.cardTop}>
              <span className={styles.icon}>{sourceIcon(source.sourceKind)}</span>
              <span className={styles.kind}>{creativeSourceKindLabel(source.sourceKind)}</span>
            </div>
            <h3>{source.name}</h3>
            <p>{source.description}</p>
            <Link className={styles.useLink} href={creativeSourceHref(source)} aria-label={`Use ${source.name} in Create`}>
              Use in Create <ArrowUpRight />
            </Link>
          </article>
        ))}
      </div>
      {nextCursor !== null ? (
        <div className={styles.pagination}>
          <button className={styles.paginationButton} type="button" disabled={loadingMore} aria-busy={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "Loading creative sources…" : "Load more creative sources"}
          </button>
          {loadMoreError ? (
            <span className={styles.paginationError} role="status">
              The next page could not load.
              <button className={styles.paginationRetry} type="button" onClick={onLoadMore}>Try again</button>
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function sourceIcon(kind: MoriCreativeSourceKind) {
  switch (kind) {
    case "audio": return <FileAudio aria-hidden="true" />
    case "voice": return <Mic2 aria-hidden="true" />
    case "inspiration": return <Sparkles aria-hidden="true" />
  }
}

function creativeSourceHref(source: MoriCreativeLibrarySource): string {
  return `/create?source_kind=${encodeURIComponent(source.sourceKind)}&source_ref=${encodeURIComponent(source.ref)}`
}
