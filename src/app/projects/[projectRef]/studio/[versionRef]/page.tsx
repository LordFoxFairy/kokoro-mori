import { previewCandidates } from "@/features/mori/preview-data"
import styles from "@/features/mori/mori-workspace.module.css"
import { StudioPageContent } from "@/features/mori/studio-page"

type StudioPageProps = { params: Promise<{ projectRef: string; versionRef: string }> }

export default async function StudioPage({ params }: StudioPageProps) {
  const { versionRef } = await params
  const candidate = previewCandidates.find((item) => item.versionRef === versionRef) ?? previewCandidates[0]

  return (
    <main className={styles.studioApp}>
      <StudioPageContent candidate={candidate} />
    </main>
  )
}
