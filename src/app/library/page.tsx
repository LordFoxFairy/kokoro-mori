import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { LibraryPageContent } from "@/features/mori/library-list"
import styles from "@/features/mori/mori-workspace.module.css"

export default function LibraryPage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="library" ariaLabel="Library"><LibraryPageContent /></MoriCatalogShell>
    </main>
  )
}
