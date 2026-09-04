import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-library.v1.json")

describe("Mori library OpenAPI contract", () => {
  it("publishes a read-only cursor-based projection with explicit filters", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/library"], "library path")
    expect(path.post).toBeUndefined()
    const get = recordValue(path.get, "library GET")
    expect(get.operationId).toBe("listMoriLibrary")
    const parameters = arrayValue(get.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(recordValue(parameters.find((parameter) => parameter.name === "kind"), "kind parameter").schema).toMatchObject({
      enum: ["all", "version"],
      default: "all",
    })
    expect(recordValue(parameters.find((parameter) => parameter.name === "limit"), "limit parameter").schema).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 100,
    })
    expect(recordValue(parameters.find((parameter) => parameter.name === "cursor"), "cursor parameter").schema).toMatchObject({
      type: "string",
      minLength: 1,
    })
  })

  it("returns a stable Version projection for the playable Library shelf", () => {
    const schemas = contractSchemas(readContract())
    const version = recordValue(schemas.MoriLibraryVersionItem, "MoriLibraryVersionItem")
    expect(version.additionalProperties).toBe(false)
    expect(arrayValue(version.required, "version required")).toEqual([
      "library_item_ref",
      "kind",
      "project_ref",
      "project_title",
      "version_ref",
      "title",
      "duration_seconds",
      "audio_asset_ref",
      "waveform_asset_ref",
      "created_at",
    ])
    expect(recordValue(version.properties, "version properties").kind).toEqual({ const: "version" })
  })

  it("keeps the projection provider-neutral and exposes only authenticated reads", () => {
    const document = readContract()
    const get = recordValue(recordValue(document.paths, "paths")["/api/v1/mori/library"], "library path").get
    expect(arrayValue(recordValue(get, "library GET").security, "security")).toEqual([{ moriSession: [] }])
    const keys = collectPropertyKeys(document)
    expect(keys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(keys.filter((key) => /provider|tenant|subject|actor|bucket|signed_url/u.test(key))).toEqual([])
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
