import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { ProjectOverviewPageContent } from "@/features/mori/project-overview"
import styles from "@/features/mori/mori-workspace.module.css"

type ProjectOverviewPageProps = { params: Promise<{ projectRef: string }> }

export default async function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const { projectRef } = await params

  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="projects" ariaLabel="Project overview"><ProjectOverviewPageContent projectRef={projectRef} /></MoriCatalogShell>
    </main>
  )
}
