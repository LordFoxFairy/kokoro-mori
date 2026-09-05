import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contract = JSON.parse(readFileSync(resolve(process.cwd(), "contract/openapi/mori-release-publish.v1.json"), "utf8")) as { openapi: string; paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, { properties?: Record<string, { enum?: string[] }> }> } }

describe("release publish contract", () => {
  it("keeps publish and unpublish as explicit commands", () => {
    expect(contract.openapi).toBe("3.1.0")
    expect(contract.paths["/api/v1/mori/versions/{version_ref}/release"]).toHaveProperty("post")
    expect(contract.paths["/api/v1/mori/releases/{release_ref}/unpublish"]).toHaveProperty("post")
  })

  it("models public visibility as a release lifecycle", () => {
    expect(contract.components.schemas.Release.properties?.status?.enum).toEqual(["publishing", "published", "failed", "unpublished"])
    expect(contract.components.schemas.Release.properties).not.toHaveProperty("share_token")
  })
})
