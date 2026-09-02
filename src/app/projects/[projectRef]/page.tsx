import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { ProjectOverviewPageContent } from "@/features/mori/project-overview"
import styles from "@/features/mori/mori-workspace.module.css"

export default function ProjectOverviewPage() {
  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="projects" ariaLabel="Project overview"><ProjectOverviewPageContent /></MoriCatalogShell>
    </main>
  )
}
