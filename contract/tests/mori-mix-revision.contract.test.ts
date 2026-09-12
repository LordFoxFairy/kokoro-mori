import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-mix-revision.v1.json")

describe("Mori Mix Revision OpenAPI contract", () => {
  it("publishes an idempotent, version-scoped immutable save command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const createPath = recordValue(paths["/api/v1/mori/versions/{version_ref}/mix_revisions"], "create path")
    const post = recordValue(createPath.post, "create POST")
    expect(post.operationId).toBe("createMixRevision")
    const parameters = arrayValue(post.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    expect(recordValue(post.responses, "responses")["201"]).toBeDefined()

    const getPath = recordValue(paths["/api/v1/mori/mix_revisions/{mix_revision_ref}"], "read path")
    expect(recordValue(getPath.get, "read GET").operationId).toBe("getMixRevision")
  })

  it("stores every track as gain and mute while leaving Solo out of the durable model", () => {
    const schemas = recordValue(recordValue(readContract().components, "components").schemas, "schemas")
    const input = recordValue(schemas.MixRevisionInput, "MixRevisionInput")
    expect(arrayValue(input.required, "input required")).toEqual(["source_stem_separation_ref", "name", "tracks"])
    const trackList = recordValue(recordValue(input.properties, "input properties").tracks, "tracks")
    expect(trackList).toMatchObject({ minItems: 1, maxItems: 12 })
    const track = recordValue(schemas.MixTrack, "MixTrack")
    expect(arrayValue(track.required, "track required")).toEqual(["stem_ref", "gain", "muted"])
    const properties = recordValue(track.properties, "track properties")
    expect(recordValue(properties.gain, "gain")).toMatchObject({ type: "number", minimum: 0, maximum: 1 })
    expect(properties.solo).toBeUndefined()
    expect(recordValue(properties.pan, "pan")).toMatchObject({ type: "number", minimum: -1, maximum: 1, multipleOf: 0.01, default: 0 })

    const revision = recordValue(schemas.MixRevision, "MixRevision")
    expect(arrayValue(revision.required, "revision required")).toEqual(expect.arrayContaining(["mix_revision_ref", "version_ref", "revision", "created_at"]))
  })

  it("keeps writable properties snake_case and provider-neutral", () => {
    const keys = collectPropertyKeys(readContract())
    expect(keys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(keys.filter((key) => /provider|tenant|subject|actor|bucket|signed_url/u.test(key))).toEqual([])
  })
})

function readContract(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(contractPath, "utf8"))
  return recordValue(value, "OpenAPI document")
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
