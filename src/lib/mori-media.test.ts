import { describe, expect, it } from "vitest"
import { buildMoriAssetContentUrl } from "./mori-media"

describe("Mori media URLs", () => {
  it("keeps opaque asset refs behind the same-origin Mori projection", () => {
    expect(buildMoriAssetContentUrl("asset/stem one")).toBe("/api/v1/mori/assets/asset%2Fstem%20one/content")
    expect(buildMoriAssetContentUrl("asset/stem one", "attachment")).toBe("/api/v1/mori/assets/asset%2Fstem%20one/content?disposition=attachment")
  })

  it("rejects an empty asset ref instead of constructing an ambiguous URL", () => {
    expect(() => buildMoriAssetContentUrl("   ")).toThrow("asset_ref_required")
  })
})
