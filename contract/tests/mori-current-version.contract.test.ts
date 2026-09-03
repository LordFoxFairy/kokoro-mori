import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-current-version.v1.json")

describe("Mori current Version OpenAPI contract", () => {
  it("publishes one idempotent compare-and-set command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/projects/{project_ref}/current_version"], "current Version path")
    expect(path.get).toBeUndefined()
    expect(path.post).toBeUndefined()
    const put = recordValue(path.put, "current Version PUT")
    expect(put.operationId).toBe("putCurrentVersion")
    const parameters = arrayValue(put.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Idempotency-Key")).toMatchObject({ in: "header", required: true })
    const responses = recordValue(put.responses, "responses")
    expect(responses["200"]).toBeDefined()
    expect(responses["409"]).toBeDefined()
    expect(responses["422"]).toBeDefined()
  })

  it("requires the exact Candidate, Version, and expected Current context", () => {
    const schemas = contractSchemas(readContract())
    const input = recordValue(schemas.CurrentVersionInput, "CurrentVersionInput")
    expect(input.additionalProperties).toBe(false)
    expect(arrayValue(input.required, "input required")).toEqual([
      "candidate_ref",
      "version_ref",
      "expected_current_version_ref",
    ])
    const properties = recordValue(input.properties, "input properties")
    expect(recordValue(properties.candidate_ref, "candidate_ref")).toMatchObject({ type: "string", minLength: 1 })
    expect(recordValue(properties.version_ref, "version_ref")).toMatchObject({ type: "string", minLength: 1 })
    expect(recordValue(properties.expected_current_version_ref, "expected_current_version_ref").oneOf).toEqual([
      { type: "null" },
      { type: "string", minLength: 1 },
    ])
  })

  it("returns enough immutable context to reject a mismatched replay", () => {
    const schemas = contractSchemas(readContract())
    const selection = recordValue(schemas.CurrentVersionSelection, "CurrentVersionSelection")
    expect(selection.additionalProperties).toBe(false)
    expect(arrayValue(selection.required, "selection required")).toEqual([
      "project_ref",
      "current_version_ref",
      "source_candidate_ref",
      "previous_version_ref",
      "selected_at",
    ])
    const properties = recordValue(selection.properties, "selection properties")
    expect(recordValue(properties.selected_at, "selected_at")).toMatchObject({ type: "string", format: "date-time" })
  })

  it("keeps writable fields snake_case and provider-neutral", () => {
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

