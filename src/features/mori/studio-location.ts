export type CanonicalStudioHrefOptions = {
  generationRef?: string | null
}

export function canonicalStudioHref(currentHref: string, projectRef: string, versionRef: string, options?: CanonicalStudioHrefOptions): string {
  const url = new URL(currentHref)
  url.pathname = `/projects/${encodeURIComponent(projectRef)}/studio/${encodeURIComponent(versionRef)}`
  if (options !== undefined && "generationRef" in options) {
    const generationRef = options.generationRef
    if (generationRef === undefined || generationRef === null || generationRef.trim() === "") url.searchParams.delete("generation_ref")
    else url.searchParams.set("generation_ref", generationRef)
  }
  return url.href
}

export function studioVersionRefFromPath(pathname: string, projectRef: string): string | null {
  const match = /^\/projects\/([^/]+)\/studio\/([^/]+)\/?$/u.exec(pathname)
  if (match === null) return null
  try {
    if (decodeURIComponent(match[1] ?? "") !== projectRef) return null
    const versionRef = decodeURIComponent(match[2] ?? "")
    return versionRef.trim() === "" ? null : versionRef
  } catch {
    return null
  }
}
