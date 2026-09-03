// @vitest-environment node

import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

describe("Mori same-origin proxy", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("forwards media range validators and preserves a partial audio response", async () => {
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("range")).toBe("bytes=1024-2047")
      expect(headers.get("if-range")).toBe('"stem-etag"')
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: {
          "accept-ranges": "bytes",
          "content-range": "bytes 1024-2047/8192",
          "content-type": "audio/mpeg",
        },
      })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const request = new NextRequest("http://localhost/api/v1/mori/assets/asset_stem/content", {
      headers: { Range: "bytes=1024-2047", "If-Range": '"stem-etag"' },
    })

    const response = await GET(request, { params: Promise.resolve({ path: ["assets", "asset_stem", "content"] }) })

    expect(response.status).toBe(206)
    expect(response.headers.get("accept-ranges")).toBe("bytes")
    expect(response.headers.get("content-range")).toBe("bytes 1024-2047/8192")
    expect(response.headers.get("content-type")).toBe("audio/mpeg")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })
})
