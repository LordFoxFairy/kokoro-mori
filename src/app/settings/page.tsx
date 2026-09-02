import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import styles from "@/features/mori/mori-workspace.module.css"

export default function SettingsPage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="settings" ariaLabel="Settings">
        <div className={styles.catalogContent}>
          <div className={styles.catalogIntro}>
            <div>
              <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Workspace</div>
              <h1 className={styles.catalogTitle}>Settings</h1>
              <p className={styles.catalogDescription}>Keep your creative defaults close, quiet, and easy to change.</p>
            </div>
          </div>
          <section className={styles.overviewPlanCard} aria-label="Workspace settings">
            <div className={styles.overviewPlanStats}>
              <span><b>Theme</b>Light gradient</span>
              <span><b>Playback</b>Remember last track</span>
              <span><b>Generation</b>Smart by default</span>
            </div>
          </section>
        </div>
      </MoriCatalogShell>
    </main>
  )
}
