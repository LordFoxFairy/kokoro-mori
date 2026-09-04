export type StudioEntrySurface = "arrangement" | "lyrics" | "stems" | "finish"
export type StudioEntryIntent = "transform" | null

export type StudioEntrySearchParams = {
  surface?: string | string[] | undefined
  intent?: string | string[] | undefined
}

export type StudioEntry = {
  surface: StudioEntrySurface
  intent: StudioEntryIntent
}

const studioEntrySurfaces: readonly StudioEntrySurface[] = ["arrangement", "lyrics", "stems", "finish"]

export function parseStudioEntry(searchParams: StudioEntrySearchParams): StudioEntry {
  const requestedSurface = firstValue(searchParams.surface)
  const surface = isStudioEntrySurface(requestedSurface) ? requestedSurface : "arrangement"
  const requestedIntent = firstValue(searchParams.intent)
  const intent = requestedSurface === "arrangement" && requestedIntent === "transform" ? "transform" : null

  return { surface, intent }
}

function isStudioEntrySurface(value: string | undefined): value is StudioEntrySurface {
  return value !== undefined && studioEntrySurfaces.some((surface) => surface === value)
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
