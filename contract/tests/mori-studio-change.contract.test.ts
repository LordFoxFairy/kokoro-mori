import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const contractPath = resolve(process.cwd(), "contract/openapi/mori-studio-change.v1.json")

describe("Mori Studio change OpenAPI contract", () => {
  it("publishes a version-bound idempotent generation command", () => {
    const document = readContract()
    expect(document.openapi).toBe("3.1.0")

    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/versions/{version_ref}/generations"], "Studio generation path")
    const post = recordValue(path.post, "Studio generation POST")
    expect(post.operationId).toBe("createStudioChange")

    const parameters = arrayValue(post.parameters, "parameters").map((value) => recordValue(value, "parameter"))
    const idempotencyHeader = parameters.find((parameter) => parameter.name === "Idempotency-Key")
    expect(idempotencyHeader).toMatchObject({ in: "header", required: true })

    const responses = recordValue(post.responses, "responses")
    expect(responses["202"]).toBeDefined()
    expect(responses["400"]).toBeDefined()
    expect(responses["409"]).toBeDefined()
  })

  it("locks the four UI operations to explicit scope schemas", () => {
    const schemas = contractSchemas(readContract())
    const input = recordValue(schemas.StudioChangeGenerationInput, "StudioChangeGenerationInput")
    const variantNames = arrayValue(input.oneOf, "Studio change variants").map((value) => {
      const ref = stringValue(recordValue(value, "variant").$ref, "variant ref")
      return ref.split("/").at(-1) ?? ""
    })

    expect(variantNames).toEqual([
      "AddPartGenerationInput",
      "ReplaceSectionGenerationInput",
      "ExtendGenerationInput",
      "TransformGenerationInput",
    ])

    const operations = variantNames.map((name) => {
      const schema = recordValue(schemas[name], name)
      const properties = recordValue(schema.properties, `${name} properties`)
      return recordValue(properties.operation, `${name} operation`).const
    })
    expect(operations).toEqual(["add_part", "replace_section", "extend", "transform"])
  })

  it("publishes refresh-safe generation snapshots for both creation paths", () => {
    const document = readContract()
    const paths = recordValue(document.paths, "paths")
    const path = recordValue(paths["/api/v1/mori/generations/{generation_ref}"], "Generation snapshot path")
    const get = recordValue(path.get, "Generation snapshot GET")
    expect(get.operationId).toBe("getGeneration")

    const responses = recordValue(get.responses, "responses")
    const ok = recordValue(responses["200"], "Generation snapshot response")
    const content = recordValue(ok.content, "Generation snapshot content")
    const json = recordValue(content["application/json"], "Generation snapshot JSON")
    expect(recordValue(json.schema, "Generation snapshot envelope").$ref).toBe("#/components/schemas/ApiGenerationSnapshot")

    const schemas = contractSchemas(document)
    const snapshot = recordValue(schemas.GenerationSnapshot, "GenerationSnapshot")
    expect(recordValue(snapshot.discriminator, "GenerationSnapshot discriminator").propertyName).toBe("generation_kind")
    const variants = arrayValue(snapshot.oneOf, "Generation snapshot variants").map((value) =>
      stringValue(recordValue(value, "Generation snapshot variant").$ref, "Generation snapshot variant ref"),
    )
    expect(variants).toEqual([
      "#/components/schemas/NewSongGenerationSnapshot",
      "#/components/schemas/StudioChangeGenerationSnapshot",
    ])

    const studioSnapshot = recordValue(schemas.StudioChangeGenerationSnapshot, "StudioChangeGenerationSnapshot")
    const studioProperties = recordValue(studioSnapshot.properties, "Studio snapshot properties")
    expect(recordValue(studioProperties.generation_kind, "Studio generation kind").const).toBe("studio_change")
    expect(recordValue(studioProperties.operation, "Studio operation").enum).toEqual([
      "add_part",
      "replace_section",
      "extend",
      "transform",
    ])
  })

  it("keeps the browser contract snake_case and provider-neutral", () => {
    const propertyKeys = collectPropertyKeys(readContract())
    expect(propertyKeys.filter((key) => /[A-Z]/u.test(key))).toEqual([])
    expect(propertyKeys.filter((key) => key.includes("provider") || key.includes("tenant") || key.includes("subject"))).toEqual([])
  })
})

function readContract(): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(contractPath, "utf8"))
  return recordValue(value, "OpenAPI document")
}

function contractSchemas(document: Record<string, unknown>): Record<string, unknown> {
  const components = recordValue(document.components, "components")
  return recordValue(components.schemas, "schemas")
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${label} must be a string`)
  return value
}

function collectPropertyKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPropertyKeys)
  if (!isRecord(value)) return []
  const ownProperties = recordValueOrNull(value.properties)
  return [
    ...(ownProperties === null ? [] : Object.keys(ownProperties)),
    ...Object.values(value).flatMap(collectPropertyKeys),
  ]
}

function recordValueOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
