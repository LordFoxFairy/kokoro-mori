import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-release-draft.v1.json")

describe("Mori release draft OpenAPI contract", () => {
  it("publishes version-bound read and idempotent optimistic save", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/versions/{version_ref}/release_draft"], "release draft path")
    expect(recordValue(path.get, "release GET").operationId).toBe("getReleaseDraft")
    const put = recordValue(path.put, "release PUT")
    expect(put.operationId).toBe("putReleaseDraft")
    const parameters = arrayValue(put.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    const responses = recordValue(put.responses, "responses")
    expect(responses["200"]).toBeDefined()
    expect(responses["409"]).toBeDefined()
    expect(responses["422"]).toBeDefined()
  })

  it("keeps visibility, remix permission, content disclosure, and artwork explicit", () => {
    const schemas = contractSchemas(readContract())
    expect(recordValue(schemas.ReleaseVisibility, "ReleaseVisibility").enum).toEqual(["private", "link_only", "public"])

    const input = recordValue(schemas.ReleaseDraftInput, "ReleaseDraftInput")
    expect(arrayValue(input.required, "input required")).toEqual([
      "title",
      "description",
      "visibility",
      "allow_remix",
      "explicit_content",
      "artwork",
      "expected_revision",
    ])
    const properties = recordValue(input.properties, "input properties")
    expect(recordValue(properties.title, "title")).toMatchObject({ type: "string", minLength: 1, maxLength: 120 })
    expect(recordValue(properties.description, "description")).toMatchObject({ type: "string", maxLength: 500 })
    expect(recordValue(properties.allow_remix, "allow_remix").type).toBe("boolean")
    expect(recordValue(properties.explicit_content, "explicit_content").type).toBe("boolean")
    expect(recordValue(properties.expected_revision, "expected_revision").oneOf).toEqual([
      { type: "null" },
      { type: "integer", minimum: 1 },
    ])

    const artwork = recordValue(schemas.ReleaseArtwork, "ReleaseArtwork")
    expect(arrayValue(artwork.oneOf, "artwork variants")).toHaveLength(2)
  })

  it("returns a draft resource and never claims publication", () => {
    const schemas = contractSchemas(readContract())
    const draft = recordValue(schemas.ReleaseDraft, "ReleaseDraft")
    expect(arrayValue(draft.required, "draft required")).toEqual(expect.arrayContaining(["release_draft_ref", "version_ref", "revision", "state", "updated_at"]))
    expect(recordValue(recordValue(draft.properties, "draft properties").state, "state")).toEqual({ type: "string", const: "draft" })
    expect(schemas.PublishInput).toBeUndefined()
    expect(schemas.PublishedRelease).toBeUndefined()
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
