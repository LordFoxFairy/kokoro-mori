export function canonicalStudioHref(currentHref: string, projectRef: string, versionRef: string): string {
  const url = new URL(currentHref)
  url.pathname = `/projects/${encodeURIComponent(projectRef)}/studio/${encodeURIComponent(versionRef)}`
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
