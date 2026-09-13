// @vitest-environment node

import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GET, PUT } from "./route"

describe("Mori same-origin proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("fails closed when a non-local BFF has no trust configuration", async () => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal("fetch", upstreamFetch)
    vi.stubEnv("KOKORO_BFF_URL", "https://bff.example.test")
    vi.stubEnv("KOKORO_BFF_SHARED_SECRET", "")
    vi.stubEnv("KOKORO_BFF_NAMESPACE", "")
    const request = new NextRequest("http://localhost/api/v1/mori/projects/project_1", {
      headers: { "x-request-id": "request-misconfigured-bff" },
    })

    const response = await GET(request, { params: Promise.resolve({ path: ["projects", "project_1"] }) })

    expect(response.status).toBe(503)
    expect(response.headers.get("x-request-id")).toBe("request-misconfigured-bff")
    expect(await response.json()).toMatchObject({
      error: { code: "mori_bff_misconfigured", retryable: false },
      meta: { request_id: "request-misconfigured-bff" },
    })
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it("forwards the session cookie and request identity without accepting a browser principal", async () => {
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("cookie")).toBe("kokoro_session=session-1")
      expect(headers.get("x-kokoro-request-id")).toBe("request-from-browser")
      expect(headers.get("x-kokoro-principal-id")).toBeNull()
      expect(headers.get("x-request-id")).toBeNull()
      return Response.json({ data: { ok: true }, meta: { request_id: "request-from-bff" } }, {
        headers: { "x-request-id": "request-from-bff" },
      })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const request = new NextRequest("http://localhost/api/v1/mori/projects/project_1", {
      headers: {
        Cookie: "kokoro_session=session-1",
        "x-kokoro-request-id": "request-from-browser",
        "x-kokoro-principal-id": "browser-forged-principal",
      },
    })

    const response = await GET(request, { params: Promise.resolve({ path: ["projects", "project_1"] }) })

    expect(response.status).toBe(200)
    expect(response.headers.get("x-request-id")).toBe("request-from-bff")
  })

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
