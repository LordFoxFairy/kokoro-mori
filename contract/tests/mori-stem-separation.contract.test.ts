import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-stem-separation.v1.json")

describe("Mori stem separation OpenAPI contract", () => {
  it("publishes a version-bound idempotent separation command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")

    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/versions/{version_ref}/stem_separations"], "stem separation path")
    const post = recordValue(path.post, "stem separation POST")
    expect(post.operationId).toBe("createStemSeparation")
    const parameters = arrayValue(post.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    const responses = recordValue(post.responses, "responses")
    expect(responses["202"]).toBeDefined()
    expect(responses["409"]).toBeDefined()
    expect(responses["422"]).toBeDefined()
  })

  it("keeps separation choices small and provider-neutral", () => {
    const schemas = contractSchemas(readContract())
    const input = recordValue(schemas.StemSeparationInput, "StemSeparationInput")
    const properties = recordValue(input.properties, "StemSeparationInput properties")
    expect(recordValue(properties.mode, "mode").$ref).toBe("#/components/schemas/StemSeparationMode")
    expect(recordValue(schemas.StemSeparationMode, "StemSeparationMode").enum).toEqual(["isolate_part", "auto_stems", "custom_stems"])
    expect(recordValue(schemas.StemTargetKind, "StemTargetKind").enum).toEqual([
      "vocals",
      "backing_vocals",
      "drums",
      "bass",
      "guitar",
      "keys",
      "strings",
      "wind",
      "synth",
      "percussion",
    ])
    const targets = recordValue(properties.target_kinds, "target_kinds")
    expect(recordValue(targets.items, "target_kinds items").$ref).toBe("#/components/schemas/StemTargetKind")
    expect(targets.uniqueItems).toBe(true)
    expect(targets.maxItems).toBe(10)
    expect(recordValue(properties.include_midi, "include_midi").type).toBe("boolean")
    expect(arrayValue(input.required, "input required")).toEqual(["mode", "target_kinds", "include_midi"])
    expect(targetCardinality(input, "isolate_part")).toEqual({ minItems: 1, maxItems: 1 })
    expect(targetCardinality(input, "auto_stems")).toEqual({ maxItems: 0 })
    expect(targetCardinality(input, "custom_stems")).toEqual({ minItems: 2, maxItems: 10 })
  })

  it("publishes durable stem assets, replay, and cancellation", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    expect(recordValue(recordValue(paths["/api/v1/mori/stem_separations/{stem_separation_ref}"], "snapshot path").get, "snapshot GET").operationId).toBe("getStemSeparation")
    const eventsGet = recordValue(recordValue(paths["/api/v1/mori/stem_separations/{stem_separation_ref}/events"], "events path").get, "events GET")
    expect(eventsGet.operationId).toBe("getStemSeparationEvents")
    expect(recordValue(recordValue(paths["/api/v1/mori/stem_separations/{stem_separation_ref}/cancel"], "cancel path").post, "cancel POST").operationId).toBe("cancelStemSeparation")

    const eventResponse = recordValue(recordValue(eventsGet.responses, "event responses")["200"], "event response")
    const eventMedia = recordValue(recordValue(eventResponse.content, "event response content")["text/event-stream"], "event media")
    expect(eventMedia["x-sse-event-prefix"]).toBe("stem_separation.")
    expect(recordValue(eventMedia["x-sse-event-payload"], "event payload").$ref).toBe("#/components/schemas/ApiStemSeparationEventPayload")

    const schemas = contractSchemas(document)
    const snapshot = recordValue(schemas.StemSeparationSnapshot, "StemSeparationSnapshot")
    expect(arrayValue(snapshot.required, "snapshot required")).toEqual(expect.arrayContaining([
      "version_ref",
      "mode",
      "target_kinds",
      "include_midi",
      "source_audio_digest",
      "stems",
      "midi_asset_ref",
      "status",
      "progress",
    ]))
    const stem = recordValue(schemas.Stem, "Stem")
    expect(arrayValue(stem.required, "stem required")).toEqual([
      "stem_ref",
      "kind",
      "label",
      "audio_asset_ref",
      "waveform_asset_ref",
      "duration_seconds",
    ])
    expect(recordValue(recordValue(snapshot.properties, "snapshot properties").stems, "stems").maxItems).toBe(12)
    expect(arrayValue(snapshot.allOf, "snapshot invariants")).not.toHaveLength(0)
    expect(recordValue(recordValue(stem.properties, "stem properties").kind, "stem kind").enum).toEqual([
      "vocals",
      "backing_vocals",
      "instrumental",
      "drums",
      "bass",
      "guitar",
      "keys",
      "strings",
      "wind",
      "synth",
      "percussion",
      "other",
    ])
  })

  it("keeps the contract snake_case and free of caller identity or provider fields", () => {
    const propertyKeys = collectPropertyKeys(readContract())
    expect(propertyKeys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(propertyKeys.filter((key) => key.includes("provider") || key.includes("tenant") || key.includes("subject") || key.includes("actor"))).toEqual([])
  })
})

function targetCardinality(schema: Record<string, unknown>, mode: string): Record<string, unknown> {
  const branch = arrayValue(schema.allOf, `${mode} branches`).map((value) => recordValue(value, `${mode} branch`)).find((value) => {
    const condition = recordValue(value.if, `${mode} condition`)
    const properties = recordValue(condition.properties, `${mode} condition properties`)
    return recordValue(properties.mode, `${mode} condition mode`).const === mode
  })
  if (branch === undefined) throw new Error(`${mode} branch is required`)
  const then = recordValue(branch.then, `${mode} then`)
  const properties = recordValue(then.properties, `${mode} then properties`)
  return recordValue(properties.target_kinds, `${mode} target cardinality`)
}

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
