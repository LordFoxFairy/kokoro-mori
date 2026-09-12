import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-library-sources.v1.json")

describe("Mori Library Sources OpenAPI contract", () => {
  it("publishes independent list and deep-link reads with opaque pagination", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    const listPath = recordValue(paths["/api/v1/mori/library/sources"], "source list path")
    const list = recordValue(listPath.get, "source list GET")
    expect(list.operationId).toBe("listMoriCreativeSources")
    expect(listPath.post).toBeUndefined()
    const listParameters = arrayValue(list.parameters, "list parameters").map((value) => recordValue(value, "parameter"))
    expect(recordValue(listParameters.find((parameter) => parameter.name === "source_kind"), "source_kind parameter").schema).toMatchObject({
      enum: ["all", "audio", "voice", "inspiration"],
      default: "all",
    })
    expect(recordValue(listParameters.find((parameter) => parameter.name === "limit"), "limit parameter").schema).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 100,
    })
    const singlePath = recordValue(paths["/api/v1/mori/library/sources/{source_kind}/{source_ref}"], "source single path")
    expect(recordValue(singlePath.get, "source single GET").operationId).toBe("getMoriCreativeSource")
    expect(singlePath.post).toBeUndefined()
  })

  it("uses source_kind as a strict three-way discriminator with type-specific metadata", () => {
    const schemas = contractSchemas(readContract())
    expect(recordValue(schemas.MoriCreativeSource, "MoriCreativeSource").discriminator).toEqual({
      propertyName: "source_kind",
      mapping: {
        audio: "#/components/schemas/MoriAudioCreativeSource",
        voice: "#/components/schemas/MoriVoiceCreativeSource",
        inspiration: "#/components/schemas/MoriInspirationCreativeSource",
      },
    })
    const audio = recordValue(schemas.MoriAudioCreativeSource, "audio source")
    expect(arrayValue(audio.required, "audio required")).toEqual(expect.arrayContaining(["source_ref", "asset_ref", "duration_seconds"]))
    expect(recordValue(audio.properties, "audio properties").asset_ref).toMatchObject({ type: "string", minLength: 1 })
    expect(arrayValue(recordValue(schemas.MoriInspirationCreativeSource, "inspiration source").required, "inspiration required")).toContain("style")
    expect(arrayValue(recordValue(schemas.MoriVoiceCreativeSource, "voice source").required, "voice required")).not.toContain("style")
    expect(recordValue(recordValue(schemas.MoriVoiceCreativeSource, "voice source").properties, "voice properties").asset_ref).toBeUndefined()
  })

  it("keeps sources authenticated, provider-neutral, and absent from write operations", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    for (const path of Object.values(paths)) {
      const get = recordValue(recordValue(path, "source path").get, "source GET")
      expect(arrayValue(get.security, "security")).toEqual([{ moriSession: [] }])
    }
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
