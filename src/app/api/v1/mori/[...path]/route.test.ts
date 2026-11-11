// @vitest-environment node

import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST, PUT } from "./route"

const origin = "https://product.example.test"
const cookie = "kokoro-issuer.session_token=native-session"
const context = (path = ["projects", "project_1"]) => ({ params: Promise.resolve({ path }) })
function nativeRequest(path = "projects/project_1", init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) {
  const headers = new Headers({ host: "product.example.test", cookie, origin })
  new Headers(init.headers).forEach((value, name) => headers.set(name, value))
  return new NextRequest(`${origin}/api/v1/mori/${path}`, { ...init, headers })
}

describe("Mori same-origin proxy", () => {
  beforeEach(() => {
    vi.stubEnv("KOKORO_BFF_BASE_URL", "http://127.0.0.1:4300")
    vi.stubEnv("KOKORO_INTERNAL_SECRET_WEB_BFF", "explicit-server-secret")
    vi.stubEnv("KOKORO_WEB_ORIGIN", origin)
    vi.stubEnv("KOKORO_BFF_URL", "")
    vi.stubEnv("KOKORO_BFF_SHARED_SECRET", "")
    vi.stubEnv("KOKORO_BFF_NAMESPACE", "")
    vi.stubEnv("KOKORO_BFF_PRINCIPAL_ID", "")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("fails closed when a non-local BFF has no trust configuration", async () => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal("fetch", upstreamFetch)
    vi.stubEnv("KOKORO_BFF_BASE_URL", "https://bff.example.test")
    vi.stubEnv("KOKORO_INTERNAL_SECRET_WEB_BFF", "")
    const request = nativeRequest("projects/project_1", {
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
      expect(headers.get("cookie")).toBe(cookie)
      expect(headers.get("x-kokoro-request-id")).toBe("request-from-browser")
      expect(headers.get("x-kokoro-principal-id")).toBeNull()
      expect(headers.get("x-request-id")).toBeNull()
      return Response.json({ data: { ok: true }, meta: { request_id: "request-from-bff" } }, {
        headers: { "x-request-id": "request-from-bff" },
      })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const request = nativeRequest("projects/project_1", {
      headers: {
        Cookie: cookie,
        "x-kokoro-request-id": "request-from-browser",
        "x-kokoro-principal-id": "browser-forged-principal",
      },
    })

    const response = await GET(request, { params: Promise.resolve({ path: ["projects", "project_1"] }) })

    expect(response.status).toBe(200)
    expect(response.headers.get("x-request-id")).toBe("request-from-bff")
  })

  it("uses the Product native identity channel and filters unrelated cookies", async () => {
    const upstreamFetch = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => Response.json({ data: { ok: true } }))
    vi.stubGlobal("fetch", upstreamFetch)
    vi.stubEnv("KOKORO_BFF_NAMESPACE", "legacy-namespace")
    vi.stubEnv("KOKORO_BFF_PRINCIPAL_ID", "legacy-principal")
    const response = await GET(nativeRequest(undefined, {
      headers: { cookie: `${cookie}; analytics=private; kokoro_session=obsolete`, "x-kokoro-namespace": "forged" },
    }), context())
    expect(response.status).toBe(200)
    const init = upstreamFetch.mock.calls[0]?.[1] as RequestInit | undefined
    const headers = new Headers(init?.headers)
    expect(headers.get("origin")).toBe(origin)
    expect(headers.get("cookie")).toBe(cookie)
    expect(headers.get("x-kokoro-service")).toBe("web-bff")
    expect(headers.get("x-kokoro-internal-secret")).toBe("explicit-server-secret")
    expect(headers.has("x-kokoro-namespace")).toBe(false)
    expect(headers.has("x-kokoro-principal-id")).toBe(false)
    expect(init?.redirect).toBe("manual")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(headers.get("accept-encoding")).toBe("identity")
  })

  it.each(["", "__Secure-"])("forwards the %sissuer cookie family, including optional companions", async (prefix) => {
    const value = `${prefix}kokoro-issuer.session_token=session; ${prefix}kokoro-issuer.session_data=data; ${prefix}kokoro-issuer.dont_remember=true`
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("cookie")).toBe(value)
      return Response.json({ data: {} })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    expect((await GET(nativeRequest(undefined, { headers: { cookie: value } }), context())).status).toBe(200)
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
  })

  it.each(["", "kokoro_session=obsolete", "kokoro-issuer.session_token=", `${cookie}; ${cookie}`])(
    "does not contact BFF for missing or ambiguous native cookies: %s", async (value) => {
      const upstreamFetch = vi.fn(async () => Response.json({ data: {} }))
      vi.stubGlobal("fetch", upstreamFetch)
      const response = await GET(nativeRequest(undefined, { headers: { cookie: value } }), context())
      expect(response.status).toBe(401)
      expect(upstreamFetch).not.toHaveBeenCalled()
    },
  )

  it.each([["origin", "https://other.example.test"], ["host", "other.example.test"]])(
    "rejects a noncanonical incoming browser %s", async (name, value) => {
      const upstreamFetch = vi.fn(async () => Response.json({ data: {} }))
      vi.stubGlobal("fetch", upstreamFetch)
      const response = await POST(nativeRequest(undefined, { method: "POST", headers: { [name]: value }, body: "{}" }), context())
      expect(response.status).toBe(403)
      expect(upstreamFetch).not.toHaveBeenCalled()
    },
  )

  it("does not infer fixture credentials from a loopback BFF", async () => {
    vi.stubEnv("KOKORO_INTERNAL_SECRET_WEB_BFF", "")
    const upstreamFetch = vi.fn(async () => Response.json({ data: {} }))
    vi.stubGlobal("fetch", upstreamFetch)
    expect((await GET(nativeRequest(), context())).status).toBe(503)
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it("accepts Next's internal URL when the public Host and Origin are canonical", async () => {
    const upstreamFetch = vi.fn(async () => Response.json({ data: {} }))
    vi.stubGlobal("fetch", upstreamFetch)
    const request = new NextRequest("http://mori-internal:3000/api/v1/mori/projects/project_1", {
      headers: { host: "product.example.test", origin, cookie },
    })
    expect((await GET(request, context())).status).toBe(200)
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
  })

  it("limits actual body bytes even when Content-Length understates them", async () => {
    const upstreamFetch = vi.fn(async () => Response.json({ data: {} }))
    vi.stubGlobal("fetch", upstreamFetch)
    const request = nativeRequest(undefined, {
      method: "POST", headers: { "content-length": "0" }, body: new Uint8Array(1024 * 1024 + 1),
    })
    const response = await POST(request, context())
    expect(response.status).toBe(413)
    expect(upstreamFetch).not.toHaveBeenCalled()
    const accepted = new Uint8Array(1024 * 1024)
    const acceptingFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Uint8Array(await new Response(init?.body).arrayBuffer())).toEqual(accepted)
      return Response.json({ data: {} })
    })
    vi.stubGlobal("fetch", acceptingFetch)
    expect((await POST(nativeRequest(undefined, { method: "POST", body: accepted }), context())).status).toBe(200)
  })

  it("keeps the binary upload exception exact and preserves its original bytes", async () => {
    const bytes = new Uint8Array(1024 * 1024 + 1).fill(7)
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Uint8Array(await new Response(init?.body).arrayBuffer())).toEqual(bytes)
      return Response.json({ data: { status: "processing" } })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const path = ["creative-source-uploads", "upload_1", "content"]
    const response = await PUT(nativeRequest(path.join("/"), { method: "PUT", body: bytes }), context(path))
    expect(response.status).toBe(200)
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
    const rejected = await PUT(nativeRequest(path.join("/"), {
      method: "PUT", headers: { "content-length": String(50 * 1024 * 1024 + 1) }, body: "x",
    }), context(path))
    expect(rejected.status).toBe(413)
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
    const wrongMethod = await POST(nativeRequest(path.join("/"), { method: "POST", body: bytes }), context(path))
    expect(wrongMethod.status).toBe(413)
  })

  it.each([
    { path: ["projects", "project_1"], milliseconds: 5_000, method: "POST" },
    { path: ["creative-source-uploads", "upload_1", "content"], milliseconds: 120_000, method: "PUT" },
  ])("cancels a stalled $method body after its $milliseconds ms budget", async ({ path, milliseconds, method }) => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const upstreamFetch = vi.fn()
    vi.stubGlobal("fetch", upstreamFetch)
    const body = new ReadableStream<Uint8Array>({ pull: () => new Promise<void>(() => {}), cancel })
    const handle = method === "POST" ? POST : PUT
    const pending = handle(nativeRequest(path.join("/"), { method, body }), context(path))
    await vi.advanceTimersByTimeAsync(milliseconds)
    expect((await pending).status).toBe(503)
    expect(cancel).toHaveBeenCalled()
    expect(upstreamFetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("allows a binary upload beyond five seconds then gives its receipt a separate budget", async () => {
    vi.useFakeTimers()
    let source!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({ start: (controller) => { source = controller } })
    const upstreamFetch = vi.fn(async () => Response.json({ data: {} }))
    vi.stubGlobal("fetch", upstreamFetch)
    const path = ["creative-source-uploads", "upload_1", "content"]
    const pending = PUT(nativeRequest(path.join("/"), { method: "PUT", body }), context(path))
    await vi.advanceTimersByTimeAsync(40_000)
    expect(upstreamFetch).not.toHaveBeenCalled()
    source.enqueue(new Uint8Array([1, 2, 3]))
    source.close()
    expect((await pending).status).toBe(200)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    { method: "GET", contentType: "application/json", path: ["projects", "project_1"] },
    { method: "POST", contentType: "audio/mpeg", path: ["projects", "project_1"] },
    { method: "PUT", contentType: "text/event-stream", path: ["creative-source-uploads", "upload_1", "content"] },
  ])("bounds the $method ordinary response through EOF even with $contentType MIME", async ({ method, contentType, path }) => {
    vi.useFakeTimers()
    let signal!: AbortSignal
    const cancel = vi.fn()
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal as AbortSignal
      return new Response(new ReadableStream({ pull: () => new Promise<void>(() => {}), cancel }), {
        headers: { "content-type": contentType },
      })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const handle = method === "GET" ? GET : method === "POST" ? POST : PUT
    const pending = handle(nativeRequest(path.join("/"), {
      method, ...(method === "GET" ? {} : { body: "{}" }),
    }), context(path))
    await vi.advanceTimersByTimeAsync(30_000)
    expect((await pending).status).toBe(503)
    expect(signal.aborted).toBe(true)
    expect(cancel).toHaveBeenCalled()
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("caps ordinary responses and keeps individual session cookie fields", async () => {
    const headers = new Headers({
      "content-type": "application/json", "content-encoding": "gzip", "content-length": "100",
      connection: "keep-alive, x-upstream-only", "x-upstream-only": "private",
    })
    const cookies = [
      "kokoro-issuer.session_token=next; Path=/; HttpOnly; Secure; SameSite=Lax",
      "kokoro-issuer.session_data=next-data; Path=/; HttpOnly; Secure; SameSite=Lax",
    ]
    for (const value of cookies) headers.append("set-cookie", value)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers })))
    const response = await GET(nativeRequest(), context())
    expect(response.headers.getSetCookie()).toEqual(cookies)
    expect(response.headers.get("cache-control")).toBe("no-store")
    for (const name of ["content-encoding", "content-length", "connection", "x-upstream-only"])
      expect(response.headers.has(name)).toBe(false)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(1024 * 1024 + 1), {
      headers: { "content-type": "application/json" },
    })))
    expect((await GET(nativeRequest(), context())).status).toBe(503)
  })

  it("bounds response headers and retires a late response without retrying", async () => {
    vi.useFakeTimers()
    let release!: (response: Response) => void
    let signal!: AbortSignal
    const cancelled = vi.fn()
    const upstreamFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal as AbortSignal
      return new Promise<Response>((resolve) => { release = resolve })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const pending = GET(nativeRequest(), context())
    await vi.advanceTimersByTimeAsync(30_000)
    expect((await pending).status).toBe(503)
    expect(signal.aborted).toBe(true)
    release(new Response(new ReadableStream({ cancel: cancelled })))
    await vi.advanceTimersByTimeAsync(0)
    expect(cancelled).toHaveBeenCalled()
    expect(upstreamFetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["audio/mpeg", "text/event-stream"])(
    "keeps %s streams alive across normal deadlines and downstream backpressure", async (contentType) => {
      vi.useFakeTimers()
      let source!: ReadableStreamDefaultController<Uint8Array>
      let signal!: AbortSignal
      const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        signal = init?.signal as AbortSignal
        expect(new Headers(init?.headers).get("last-event-id")).toBe("event_1")
        return new Response(new ReadableStream<Uint8Array>({ start: (controller) => { source = controller } }), {
          headers: { "content-type": contentType },
        })
      })
      vi.stubGlobal("fetch", upstreamFetch)
      const response = await GET(nativeRequest(undefined, { headers: { "last-event-id": "event_1" } }), context())
      const reader = response.body!.getReader()
      source.enqueue(new Uint8Array([1]))
      expect((await reader.read()).value).toEqual(new Uint8Array([1]))
      await vi.advanceTimersByTimeAsync(90_000)
      expect(signal.aborted).toBe(false)
      source.enqueue(new Uint8Array([2]))
      expect((await reader.read()).value).toEqual(new Uint8Array([2]))
      source.close()
      expect((await reader.read()).done).toBe(true)
      reader.releaseLock()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(["idle", "browser", "downstream"])("cancels media upstream on %s termination", async (termination) => {
    vi.useFakeTimers()
    let signal!: AbortSignal
    const cancel = vi.fn()
    const browser = new AbortController()
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal as AbortSignal
      return new Response(new ReadableStream({ pull: () => new Promise<void>(() => {}), cancel }), {
        headers: { "content-type": "audio/mpeg" },
      })
    }))
    const response = await GET(nativeRequest(undefined, { signal: browser.signal }), context())
    const reader = response.body!.getReader()
    if (termination === "downstream") await reader.cancel()
    else {
      const reading = reader.read().then(() => "unexpected EOF", () => "cancelled")
      if (termination === "browser") browser.abort()
      else await vi.advanceTimersByTimeAsync(60_000)
      expect(await reading).toBe("cancelled")
    }
    expect(signal.aborted).toBe(true)
    expect(cancel).toHaveBeenCalled()
    reader.releaseLock()
    expect(vi.getTimerCount()).toBe(0)
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
          "content-range": "bytes 1024-1026/8192",
          "content-type": "audio/mpeg",
        },
      })
    })
    vi.stubGlobal("fetch", upstreamFetch)
    const request = nativeRequest("assets/asset_stem/content", {
      headers: { Range: "bytes=1024-2047", "If-Range": '"stem-etag"' },
    })

    const response = await GET(request, { params: Promise.resolve({ path: ["assets", "asset_stem", "content"] }) })

    expect(response.status).toBe(206)
    expect(response.headers.get("accept-ranges")).toBe("bytes")
    expect(response.headers.get("content-range")).toBe("bytes 1024-1026/8192")
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
    const request = nativeRequest("projects/project_1/current_version", {
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
