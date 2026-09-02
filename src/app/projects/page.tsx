import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { ProjectsPageContent } from "@/features/mori/project-list"
import styles from "@/features/mori/mori-workspace.module.css"

export default function ProjectsPage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="projects" ariaLabel="Projects"><ProjectsPageContent /></MoriCatalogShell>
    </main>
  )
}
