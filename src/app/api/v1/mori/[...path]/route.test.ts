// @vitest-environment node

import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GET, PUT } from "./route"

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

  it("forwards PUT commands with their body and idempotency identity", async () => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:4300/v1/mori/projects/project_1/current_version")
      expect(init?.method).toBe("PUT")
      expect(new Headers(init?.headers).get("idempotency-key")).toBe("current-version-command-1")
      expect(await new Response(init?.body).text()).toBe(JSON.stringify({
        candidate_ref: "candidate_2",
        version_ref: "version_2",
        expected_current_version_ref: "version_1",
      }))
      return Response.json({
        data: {
          project_ref: "project_1",
          current_version_ref: "version_2",
          source_candidate_ref: "candidate_2",
          previous_version_ref: "version_1",
          selected_at: "2026-09-03T20:00:00.000Z",
        },
        meta: { request_id: "request_1" },
      })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const request = new NextRequest("http://localhost/api/v1/mori/projects/project_1/current_version", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "current-version-command-1",
      },
      body: JSON.stringify({
        candidate_ref: "candidate_2",
        version_ref: "version_2",
        expected_current_version_ref: "version_1",
      }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ path: ["projects", "project_1", "current_version"] }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: { project_ref: "project_1", current_version_ref: "version_2" },
      meta: { request_id: "request_1" },
    })
  })
})
