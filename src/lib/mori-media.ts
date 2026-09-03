export type MoriAssetDisposition = "inline" | "attachment"

const defaultMoriApiBasePath = "/api/v1/mori"

export function buildMoriAssetContentUrl(
  assetRef: string,
  disposition: MoriAssetDisposition = "inline",
  apiBasePath = defaultMoriApiBasePath,
): string {
  const normalizedAssetRef = assetRef.trim()
  if (normalizedAssetRef === "") throw new Error("asset_ref_required")
  const normalizedBasePath = apiBasePath.replace(/\/$/u, "")
  const contentUrl = `${normalizedBasePath}/assets/${encodeURIComponent(normalizedAssetRef)}/content`
  return disposition === "attachment" ? `${contentUrl}?disposition=attachment` : contentUrl
}
