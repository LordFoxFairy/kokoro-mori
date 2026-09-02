import { Download, FolderKanban, Headphones, Music2 } from "lucide-react"
import { previewLibrary } from "./preview-data"
import styles from "./mori-workspace.module.css"

const filters = ["All", "Projects", "Versions", "Lyrics", "Exports"]

export function LibraryPageContent() {
  return (
    <div className={styles.catalogContent}>
      <div className={styles.catalogIntro}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Everything you make</div>
          <h1 className={styles.catalogTitle}>Library</h1>
          <p className={styles.catalogDescription}>A calm shelf for the pieces you want to return to.</p>
        </div>
        <button className={styles.ghostButton} type="button"><Download size={14} /> Export center</button>
      </div>
      <div className={styles.filterBar} aria-label="Library filters">
        {filters.map((filter, index) => <button className={`${styles.filterButton} ${index === 0 ? styles.filterButtonActive : ""}`} type="button" key={filter}>{filter}</button>)}
      </div>
      <div className={styles.libraryList}>
        {previewLibrary.map((item) => {
          const isProject = item.kind === "project"
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
              <button className={styles.iconButton} type="button" aria-label={`Open ${item.title}`}><Music2 size={14} /></button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
