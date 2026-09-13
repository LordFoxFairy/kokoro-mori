import { MoriCatalogShell } from "@/features/mori/components/mori-catalog-shell"
import { ProjectOverviewPageContent } from "@/features/mori/project-overview"
import { previewProject } from "@/features/mori/preview-data"
import styles from "@/features/mori/mori-workspace.module.css"

type ProjectOverviewPageProps = {
  params: Promise<{ projectRef: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ProjectOverviewPage({ params, searchParams }: ProjectOverviewPageProps) {
  const { projectRef } = await params
  const generationRef = normalizeGenerationRef(searchParams === undefined ? undefined : (await searchParams).generation_ref)

  return (
    <main className={styles.catalogApp}>
      <MoriCatalogShell activeKey="projects" ariaLabel="Project overview" projectRef={projectRef} projectTitle={projectRef === previewProject.projectRef ? previewProject.title : undefined} projectMeta={projectRef === previewProject.projectRef ? `${previewProject.candidateCount} directions` : undefined}><ProjectOverviewPageContent projectRef={projectRef} generationRef={generationRef} /></MoriCatalogShell>
    </main>
  )
}

function normalizeGenerationRef(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 200 ? candidate : undefined
}
