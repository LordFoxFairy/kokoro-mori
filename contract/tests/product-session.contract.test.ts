import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sessionContracts = [
  "mori-library.v1.json",
  "mori-library-sources.v1.json",
  "mori-composition.v1.json",
  "mori-creative-source-ingest.v1.json",
  "mori-media-access.v1.json",
  "mori-release-publish.v1.json",
  "mori-share.v1.json",
]
const sessionAlternatives = [{ productSession: [] }, { productSecureSession: [] }]
const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options"])

describe("Mori consumes the established Product native session", () => {
  it.each(sessionContracts)("%s accepts regular or secure issuer cookies", (filename) => {
    const document = JSON.parse(readFileSync(resolve(process.cwd(), "contract/openapi", filename), "utf8")) as {
      components: { securitySchemes: Record<string, unknown> }
      paths: Record<string, Record<string, { security?: unknown }>>
    }
    expect(document.components.securitySchemes).toEqual({
      productSession: { type: "apiKey", in: "cookie", name: "kokoro-issuer.session_token" },
      productSecureSession: { type: "apiKey", in: "cookie", name: "__Secure-kokoro-issuer.session_token" },
    })
    for (const path of Object.values(document.paths)) {
      for (const [method, operation] of Object.entries(path)) {
        if (methods.has(method)) expect(operation.security).toEqual(sessionAlternatives)
      }
    }
  })
})
