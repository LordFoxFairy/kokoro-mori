import { MoriWorkspace } from "@/features/mori/mori-workspace"
import { resolveCreativeSourceSelection } from "@/features/mori/creative-assets"

type CreatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CreatePage({ searchParams }: CreatePageProps = {}) {
  const params = searchParams === undefined ? {} : await searchParams
  const projectRef = normalizeProjectRef(params.project_ref)
  const generationRef = normalizeProjectRef(params.generation_ref)
  const initialPrompt = normalizeIdea(params.idea)
  const initialCreativeSource = resolveCreativeSourceSelection(normalizeScalar(params.source_kind), normalizeScalar(params.source_ref))

  return <MoriWorkspace projectRef={projectRef} generationRef={generationRef} initialPrompt={initialPrompt} initialCreativeSource={initialCreativeSource} />
}

function normalizeProjectRef(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 200 ? candidate : undefined
}

function normalizeScalar(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 200 ? candidate : undefined
}

function normalizeIdea(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 1000 ? candidate : undefined
}
