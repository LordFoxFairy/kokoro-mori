import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-media-access.v1.json")

describe("Mori media access OpenAPI contract", () => {
  it("publishes authenticated byte-range playback and explicit attachment download", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/assets/{asset_ref}/content"], "asset content path")
    const get = recordValue(path.get, "asset content GET")
    expect(get.operationId).toBe("getMoriAssetContent")

    const parameters = arrayValue(get.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    expect(parameters.find((parameter) => parameter.name === "Range")).toMatchObject({ in: "header", required: false })
    expect(parameters.find((parameter) => parameter.name === "If-Range")).toMatchObject({ in: "header", required: false })
    const disposition = parameters.find((parameter) => parameter.name === "disposition")
    expect(recordValue(disposition?.schema, "disposition schema").enum).toEqual(["inline", "attachment"])

    const responses = recordValue(get.responses, "responses")
    expect(recordValue(responses["200"], "200 response").content).toBeDefined()
    const partial = recordValue(responses["206"], "206 response")
    expect(recordValue(partial.headers, "206 headers")).toMatchObject({
      "Accept-Ranges": expect.any(Object),
      "Content-Range": expect.any(Object),
    })
    const partialContent = recordValue(partial.content, "206 content")
    expect(recordValue(partialContent["audio/*"], "audio media").schema).toEqual({ type: "string", contentEncoding: "binary" })
    expect(responses["401"]).toBeDefined()
    expect(responses["403"]).toBeDefined()
    expect(responses["404"]).toBeDefined()
  })

  it("does not expose caller identity, storage, or provider fields", () => {
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
