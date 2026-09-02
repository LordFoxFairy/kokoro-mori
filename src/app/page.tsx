import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { HomePageContent } from "@/features/mori/home-page"
import styles from "@/features/mori/mori-workspace.module.css"

export default function HomePage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="home" ariaLabel="Home">
        <HomePageContent />
      </MoriCatalogShell>
    </main>
  )
}
