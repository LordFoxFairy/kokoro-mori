import { MoriWorkspace } from "@/features/mori/mori-workspace"
import { resolvePreviewCreativeSource } from "@/features/mori/creative-assets"

type CreatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CreatePage({ searchParams }: CreatePageProps = {}) {
  const params = searchParams === undefined ? {} : await searchParams
  const projectRef = normalizeProjectRef(params.project_ref)
  const initialCreativeSource = resolvePreviewCreativeSource(normalizeScalar(params.source_kind), normalizeScalar(params.source_ref))

  return <MoriWorkspace projectRef={projectRef} initialCreativeSource={initialCreativeSource} />
}

function normalizeProjectRef(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 200 ? candidate : undefined
}

function normalizeScalar(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 200 ? candidate : undefined
}
