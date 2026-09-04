import { previewCandidates } from "@/features/mori/preview-data"
import styles from "@/features/mori/mori-workspace.module.css"
import { parseStudioEntry, type StudioEntrySearchParams } from "@/features/mori/studio-entry"
import { StudioPageContent } from "@/features/mori/studio-page"

type StudioPageProps = {
  params: Promise<{ projectRef: string; versionRef: string }>
  searchParams: Promise<StudioEntrySearchParams>
}

export default async function StudioPage({ params, searchParams }: StudioPageProps) {
  const { projectRef, versionRef } = await params
  const studioEntry = parseStudioEntry(await searchParams)
  const candidate = previewCandidates.find((item) => item.versionRef === versionRef) ?? previewCandidates[0]

  return (
    <main className={styles.studioApp}>
      <StudioPageContent
        candidate={candidate}
        projectRef={projectRef}
        versionRef={versionRef}
        initialSurface={studioEntry.surface}
        initialIntent={studioEntry.intent}
        initialGenerationRef={studioEntry.generationRef}
      />
    </main>
  )
}
