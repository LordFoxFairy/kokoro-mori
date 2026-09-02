import { MoriWorkspace } from "@/features/mori/mori-workspace"

type CreatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CreatePage({ searchParams }: CreatePageProps = {}) {
  const params = searchParams === undefined ? {} : await searchParams
  const projectRef = normalizeProjectRef(params.project_ref)

  return <MoriWorkspace projectRef={projectRef} />
}

function normalizeProjectRef(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim()
  return candidate !== undefined && candidate !== "" && candidate.length <= 200 ? candidate : undefined
}
