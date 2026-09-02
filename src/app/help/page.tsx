import { CircleHelp } from "lucide-react"
import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import styles from "@/features/mori/mori-workspace.module.css"

export default function HelpPage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="help" ariaLabel="Help and feedback">
        <div className={styles.catalogContent}>
          <div className={styles.catalogIntro}>
            <div>
              <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Mori guide</div>
              <h1 className={styles.catalogTitle}>Help &amp; feedback</h1>
              <p className={styles.catalogDescription}>Learn the small rhythm of Mori, or tell us where the experience feels off.</p>
            </div>
          </div>
          <section className={styles.overviewPlanCard} aria-label="Help resources">
            <div className={styles.planMetaLine}><CircleHelp size={14} /><span>Start in Create, keep your Song Plan visible, and compare directions before promoting a Version.</span></div>
          </section>
        </div>
      </MoriCatalogShell>
    </main>
  )
}
