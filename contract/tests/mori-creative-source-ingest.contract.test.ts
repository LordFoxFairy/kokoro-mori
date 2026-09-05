import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-creative-source-ingest.v1.json")
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as { openapi: string; paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, Record<string, unknown>> } }

describe("creative source ingest contract", () => {
  it("keeps upload lifecycle endpoints explicit", () => {
    expect(contract.openapi).toBe("3.1.0")
    expect(Object.keys(contract.paths)).toEqual(expect.arrayContaining([
      "/api/v1/mori/creative-source-uploads",
      "/api/v1/mori/creative-source-uploads/{upload_ref}",
      "/api/v1/mori/creative-source-uploads/{upload_ref}/content",
      "/api/v1/mori/creative-source-uploads/{upload_ref}/cancel",
    ]))
  })

  it("models ready as a named state without provider fields", () => {
    const upload = contract.components.schemas.Upload
    expect((upload.properties as Record<string, { enum?: string[] }>).status.enum).toEqual(expect.arrayContaining(["processing", "ready", "failed", "cancelled", "expired"]))
    expect(upload.properties).not.toHaveProperty("provider")
  })
})
