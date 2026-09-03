import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-artwork-generation.v1.json")

describe("Mori artwork generation OpenAPI contract", () => {
  it("publishes a version-bound idempotent artwork command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const create = recordValue(recordValue(paths["/api/v1/mori/versions/{version_ref}/artwork_generations"], "create path").post, "create POST")
    expect(create.operationId).toBe("createArtworkGeneration")
    const parameters = arrayValue(create.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    expect(recordValue(create.responses, "responses")["202"]).toBeDefined()
  })

  it("keeps the visual direction small, square, text-free, and provider-neutral", () => {
    const schemas = contractSchemas(readContract())
    expect(recordValue(schemas.ArtworkStyle, "ArtworkStyle").enum).toEqual(["abstract", "editorial", "illustrated", "photographic"])
    expect(recordValue(schemas.ArtworkPalette, "ArtworkPalette").enum).toEqual(["warm_dawn", "violet_night", "mint_haze", "monochrome"])

    const input = recordValue(schemas.ArtworkGenerationInput, "ArtworkGenerationInput")
    expect(arrayValue(input.required, "input required")).toEqual(["prompt", "style", "palette", "aspect_ratio", "text_policy", "output_count"])
    const properties = recordValue(input.properties, "input properties")
    expect(recordValue(properties.prompt, "prompt")).toMatchObject({ type: "string", minLength: 1, maxLength: 400 })
    expect(recordValue(properties.aspect_ratio, "aspect_ratio")).toMatchObject({ type: "string", const: "1:1" })
    expect(recordValue(properties.text_policy, "text_policy")).toMatchObject({ type: "string", const: "no_text" })
    expect(recordValue(properties.output_count, "output_count")).toMatchObject({ type: "integer", const: 4 })
  })

  it("publishes durable image candidates, replay, and cancellation", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    expect(recordValue(recordValue(paths["/api/v1/mori/artwork_generations/{artwork_generation_ref}"], "snapshot path").get, "snapshot GET").operationId).toBe("getArtworkGeneration")
    const events = recordValue(recordValue(paths["/api/v1/mori/artwork_generations/{artwork_generation_ref}/events"], "events path").get, "events GET")
    expect(events.operationId).toBe("getArtworkGenerationEvents")
    const stream = recordValue(recordValue(recordValue(recordValue(events.responses, "responses")["200"], "200").content, "content")["text/event-stream"], "stream")
    expect(stream["x-sse-event-prefix"]).toBe("artwork_generation.")
    expect(recordValue(recordValue(paths["/api/v1/mori/artwork_generations/{artwork_generation_ref}/cancel"], "cancel path").post, "cancel POST").operationId).toBe("cancelArtworkGeneration")

    const schemas = contractSchemas(document)
    const candidate = recordValue(schemas.ArtworkCandidate, "ArtworkCandidate")
    expect(arrayValue(candidate.required, "candidate required")).toEqual(["artwork_candidate_ref", "image_asset_ref", "thumbnail_asset_ref", "alt_text"])
    const snapshot = recordValue(schemas.ArtworkGenerationSnapshot, "ArtworkGenerationSnapshot")
    expect(arrayValue(snapshot.required, "snapshot required")).toEqual(expect.arrayContaining([
      "artwork_generation_ref",
      "version_ref",
      "prompt",
      "style",
      "palette",
      "aspect_ratio",
      "text_policy",
      "output_count",
      "candidates",
    ]))
  })

  it("does not expose caller identity, storage, or provider fields", () => {
    const keys = collectPropertyKeys(readContract())
    expect(keys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(keys.filter((key) => /provider|tenant|subject|actor|bucket|signed_url|storage_url/u.test(key))).toEqual([])
  })
})

function readContract(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(contractPath, "utf8"))
  return recordValue(value, "OpenAPI document")
}

function contractSchemas(document: Record<string, unknown>): Record<string, unknown> {
  return recordValue(recordValue(document.components, "components").schemas, "schemas")
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function collectPropertyKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPropertyKeys)
  if (!isRecord(value)) return []
  const properties = isRecord(value.properties) ? Object.keys(value.properties) : []
  return [...properties, ...Object.values(value).flatMap(collectPropertyKeys)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
