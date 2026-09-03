import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-export.v1.json")

describe("Mori Export OpenAPI contract", () => {
  it("publishes an idempotent asynchronous render command scoped to one Version", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const createPath = recordValue(paths["/api/v1/mori/versions/{version_ref}/exports"], "create path")
    const post = recordValue(createPath.post, "create POST")
    expect(post.operationId).toBe("createVersionExport")
    const parameters = arrayValue(post.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "version_ref")).toMatchObject({ in: "path", required: true })
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    expect(recordValue(post.responses, "responses")["202"]).toBeDefined()

    const readPath = recordValue(paths["/api/v1/mori/exports/{export_ref}"], "read path")
    expect(recordValue(readPath.get, "read GET").operationId).toBe("getExport")
  })

  it("makes source, scope, and format explicit without advertising unfinished scopes", () => {
    const schemas = contractSchemas()
    const input = recordValue(schemas.ExportInput, "ExportInput")
    expect(arrayValue(input.required, "input required")).toEqual(["source", "scope", "format"])

    const versionSource = recordValue(schemas.VersionExportSource, "VersionExportSource")
    expect(recordValue(recordValue(versionSource.properties, "version source properties").type, "version source type").const).toBe("version")
    const mixSource = recordValue(schemas.MixRevisionExportSource, "MixRevisionExportSource")
    expect(arrayValue(mixSource.required, "mix source required")).toEqual(["type", "mix_revision_ref"])

    const scope = recordValue(schemas.FullSongExportScope, "FullSongExportScope")
    expect(recordValue(recordValue(scope.properties, "scope properties").type, "scope type").const).toBe("full_song")
    expect(JSON.stringify(schemas)).not.toMatch(/selected_range|multitrack/u)

    const format = recordValue(recordValue(input.properties, "input properties").format, "format")
    expect(arrayValue(format.enum, "format enum")).toEqual(["mp3", "wav"])
  })

  it("echoes render context in the durable snapshot and stays provider-neutral", () => {
    const schemas = contractSchemas()
    const snapshot = recordValue(schemas.ExportSnapshot, "ExportSnapshot")
    expect(arrayValue(snapshot.required, "snapshot required")).toEqual(expect.arrayContaining([
      "export_ref",
      "project_ref",
      "version_ref",
      "source",
      "scope",
      "format",
      "status",
      "download_url",
      "created_at",
    ]))

    const keys = collectPropertyKeys(readContract())
    expect(keys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(keys.filter((key) => /provider|tenant|subject|actor|bucket|signed_url/u.test(key))).toEqual([])
  })

  it("requires a download URL only for a succeeded export", () => {
    const snapshot = recordValue(contractSchemas().ExportSnapshot, "ExportSnapshot")
    const variants = arrayValue(snapshot.oneOf, "snapshot status variants").map((value) => recordValue(value, "snapshot status variant"))
    expect(variants).toHaveLength(2)

    const serialized = JSON.stringify(variants)
    expect(serialized).toContain('"const":"succeeded"')
    expect(serialized).toContain('"enum":["queued","processing","failed"]')
    expect(serialized).toContain('"download_url":{"type":"null"}')
    expect(serialized).toContain('"download_url":{"type":"string"')
  })
})

function readContract(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(contractPath, "utf8"))
  return recordValue(value, "OpenAPI document")
}

function contractSchemas(): Record<string, unknown> {
  return recordValue(recordValue(readContract().components, "components").schemas, "schemas")
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
