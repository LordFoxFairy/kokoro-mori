import { ArrowUpRight, Clock3, Music2 } from "lucide-react"
import Link from "next/link"
import { previewProject } from "./preview-data"
import styles from "./mori-workspace.module.css"

export function ProjectsPageContent() {
  return (
    <div className={styles.catalogContent}>
      <div className={styles.catalogIntro}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Your body of work</div>
          <h1 className={styles.catalogTitle}>Projects</h1>
          <p className={styles.catalogDescription}>Keep every direction, version, and little spark connected.</p>
        </div>
        <Link className={styles.generateButton} href="/create"><Music2 size={15} /> New project</Link>
      </div>
      <div className={styles.projectGrid}>
        <article className={styles.projectCard}>
          <div className={`${styles.projectArtwork} ${styles.projectArtworkLavender}`}><span>01</span></div>
          <div className={styles.projectCardBody}>
            <div className={styles.projectCardMeta}><span>Active project</span><span className={styles.liveDot}>● Live</span></div>
            <h2>{previewProject.title}</h2>
            <p>{previewProject.description}</p>
            <div className={styles.projectCardFooter}>
              <span><Clock3 size={13} /> <strong>Last activity</strong> {previewProject.lastActivity}</span>
              <span><strong>Current version</strong> {previewProject.currentVersionRef ? "Ready" : "Not started"}</span>
            </div>
            <Link className={styles.projectContinue} href={`/projects/${previewProject.projectRef}`}>
              Continue creating <ArrowUpRight size={14} />
            </Link>
          </div>
        </article>
        <Link className={styles.newProjectCard} href="/create" aria-label="Create another project">
          <span className={styles.newProjectIcon}>+</span>
          <strong>Start another idea</strong>
          <span>Begin with a thought, a mood, or a reference.</span>
        </Link>
      </div>
    </div>
  )
}
