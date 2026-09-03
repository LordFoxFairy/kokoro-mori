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
      const schemaName = name === "AddPartGenerationInput"
        ? "InsertPartGenerationInput"
        : name === "TransformGenerationInput"
          ? "StandardTransformGenerationInput"
          : name
      const schema = recordValue(schemas[schemaName], schemaName)
      const properties = recordValue(schema.properties, `${name} properties`)
      return recordValue(properties.operation, `${name} operation`).const
    })
    expect(operations).toEqual(["add_part", "replace_section", "extend", "transform"])
  })

  it("models Remaster as a typed whole-version transform instead of a fifth top-level operation", () => {
    const schemas = contractSchemas(readContract())
    const transform = recordValue(schemas.TransformGenerationInput, "TransformGenerationInput")
    const variants = arrayValue(transform.oneOf, "Transform variants").map((value) => {
      const ref = stringValue(recordValue(value, "Transform variant").$ref, "Transform variant ref")
      return ref.split("/").at(-1) ?? ""
    })
    expect(variants).toEqual(["StandardTransformGenerationInput", "RemasterGenerationInput"])

    const remaster = recordValue(schemas.RemasterGenerationInput, "RemasterGenerationInput")
    expect(arrayValue(remaster.required, "Remaster required fields")).toEqual(expect.arrayContaining([
      "intent",
      "source",
      "variation_strength",
    ]))
    const properties = recordValue(remaster.properties, "Remaster properties")
    expect(recordValue(properties.operation, "Remaster operation").const).toBe("transform")
    expect(recordValue(properties.scope, "Remaster scope").$ref).toBe("#/components/schemas/WholeVersionScope")
    expect(recordValue(properties.intent, "Remaster intent").const).toBe("remaster")
    expect(recordValue(properties.variation_strength, "Remaster strength").enum).toEqual(["subtle", "balanced", "bold"])
    expect(recordValue(properties.output_count, "Remaster output count").const).toBe(2)

    const source = recordValue(schemas.RemasterSource, "RemasterSource")
    expect(arrayValue(source.oneOf, "Remaster sources")).toHaveLength(2)
  })

  it("models whole-version vocal and instrumental layers as typed add-part variants", () => {
    const schemas = contractSchemas(readContract())
    const addPart = recordValue(schemas.AddPartGenerationInput, "AddPartGenerationInput")
    const variants = arrayValue(addPart.oneOf, "Add part variants").map((value) => {
      const ref = stringValue(recordValue(value, "Add part variant").$ref, "Add part variant ref")
      return ref.split("/").at(-1) ?? ""
    })
    expect(variants).toEqual(["InsertPartGenerationInput", "WholeVersionLayerGenerationInput"])

    const layer = recordValue(schemas.WholeVersionLayerGenerationInput, "WholeVersionLayerGenerationInput")
    const required = arrayValue(layer.required, "Whole-Version layer required fields")
    expect(required).toEqual(expect.arrayContaining(["part_kind", "lyrics", "voice_ref"]))
    const properties = recordValue(layer.properties, "Whole-Version layer properties")
    expect(recordValue(properties.scope, "Whole-Version layer scope").$ref).toBe("#/components/schemas/WholeVersionScope")
    expect(recordValue(properties.part_kind, "Whole-Version layer kind").enum).toEqual(["vocals", "instrumental"])
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
    const studioVariants = arrayValue(studioSnapshot.oneOf, "Studio snapshot variants").map((value) => {
      const ref = stringValue(recordValue(value, "Studio snapshot variant").$ref, "Studio snapshot variant ref")
      return ref.split("/").at(-1) ?? ""
    })
    expect(studioVariants).toEqual(["StandardStudioChangeGenerationSnapshot", "StudioRemasterGenerationSnapshot"])

    const standardStudioSnapshot = recordValue(schemas.StandardStudioChangeGenerationSnapshot, "StandardStudioChangeGenerationSnapshot")
    const studioProperties = recordValue(standardStudioSnapshot.properties, "Studio snapshot properties")
    expect(recordValue(studioProperties.generation_kind, "Studio generation kind").const).toBe("studio_change")
    expect(recordValue(studioProperties.operation, "Studio operation").enum).toEqual([
      "add_part",
      "replace_section",
      "extend",
      "transform",
    ])

    const remasterSnapshot = recordValue(schemas.StudioRemasterGenerationSnapshot, "StudioRemasterGenerationSnapshot")
    expect(arrayValue(remasterSnapshot.required, "Remaster snapshot required fields")).toEqual(expect.arrayContaining([
      "intent",
      "source",
      "variation_strength",
    ]))
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
