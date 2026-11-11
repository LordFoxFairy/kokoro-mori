import { NextRequest } from "next/server"

export const runtime = "nodejs"

const MiB = 1024 * 1024
const nativeCookieNames = new Set([
  "kokoro-issuer.session_token", "kokoro-issuer.session_data", "kokoro-issuer.dont_remember",
  "__Secure-kokoro-issuer.session_token", "__Secure-kokoro-issuer.session_data", "__Secure-kokoro-issuer.dont_remember",
])
const hopByHopHeaders = new Set([
  "connection", "content-length", "content-encoding", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
  "proxy-authenticate", "proxy-authorization", "set-cookie",
])
type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET")
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST")
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "PUT")
}

function productConfig() {
  const base = process.env.KOKORO_BFF_BASE_URL?.trim()
  const secret = process.env.KOKORO_INTERNAL_SECRET_WEB_BFF?.trim()
  const origin = process.env.KOKORO_WEB_ORIGIN?.trim()
  if (!base || !secret || !origin) return null
  try {
    const bff = new URL(base)
    const web = new URL(origin)
    if (!/^https?:$/u.test(bff.protocol) || bff.username || bff.password || bff.search || bff.hash ||
      !/^https?:$/u.test(web.protocol) || web.origin !== origin) return null
    return { base: base.replace(/\/+$/u, ""), secret, origin, host: web.host }
  } catch {
    return null
  }
}

function nativeCookie(request: Request): string | null {
  const values = new Map<string, string>()
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=")
    const name = (separator <= 0 ? part : part.slice(0, separator)).trim()
    if (!nativeCookieNames.has(name)) continue
    const value = part.slice(separator + 1).trim()
    if (separator <= 0 || !value || /[\u0000-\u001f\u007f]/u.test(value) || values.has(name)) return null
    values.set(name, value)
  }
  return values.size ? [...values].map(([name, value]) => `${name}=${value}`).join("; ") : null
}

function failure(status: number, code: string, requestId: string): Response {
  const messages: Record<string, string> = {
    mori_bff_misconfigured: "Mori BFF connection is not configured",
    mori_bff_unavailable: "Mori BFF is unavailable",
    mori_origin_rejected: "Mori request origin is not allowed",
    session_authentication_required: "A native Product session is required",
    mori_request_invalid: "Mori request path is invalid",
    mori_request_body_too_large: "Mori request body is too large",
  }
  return Response.json({
    error: { code, message: messages[code], retryable: code === "mori_bff_unavailable", details: null },
    meta: { request_id: requestId },
  }, { status, headers: { "cache-control": "no-store", "x-request-id": requestId } })
}

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let aborted!: () => void
  const cancelled = new Promise<never>((_resolve, reject) => {
    aborted = () => reject(signal.reason)
    signal.addEventListener("abort", aborted, { once: true })
    if (signal.aborted) aborted()
  })
  try {
    return await Promise.race([work, cancelled])
  } finally {
    signal.removeEventListener("abort", aborted)
  }
}

async function boundedBody(body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal): Promise<ArrayBuffer> {
  if (body === null) return new ArrayBuffer(0)
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let ended = false
  try {
    while (true) {
      signal.throwIfAborted()
      const next = await abortable(reader.read(), signal)
      if (next.done) { ended = true; break }
      size += next.value.byteLength
      if (size > limit) throw new Error("mori_request_body_too_large")
      chunks.push(next.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes.buffer
  } finally {
    if (!ended) void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST" | "PUT") {
  const started = Date.now()
  const suppliedId = request.headers.get("x-kokoro-request-id") ?? request.headers.get("x-request-id")
  const requestId = suppliedId !== null && /^[A-Za-z0-9_-]{1,128}$/u.test(suppliedId) ? suppliedId : crypto.randomUUID()
  const config = productConfig()
  if (config === null) return failure(503, "mori_bff_misconfigured", requestId)
  const url = new URL(request.url)
  const incomingOrigin = request.headers.get("origin")
  if (request.headers.get("host") !== config.host ||
    (incomingOrigin !== null && incomingOrigin !== config.origin) || (method !== "GET" && incomingOrigin === null))
    return failure(403, "mori_origin_rejected", requestId)
  const cookie = nativeCookie(request)
  if (cookie === null) return failure(401, "session_authentication_required", requestId)
  const { path } = await context.params
  if (path.length === 0 || path.some((segment) => !segment || segment === "." || segment === ".." || /[/\\\u0000-\u001f\u007f]/u.test(segment)))
    return failure(400, "mori_request_invalid", requestId)
  const upload = method === "PUT" && path.length === 3 && path[0] === "creative-source-uploads" && path[2] === "content"
  const bodyLimit = upload ? 50 * MiB : MiB
  const length = request.headers.get("content-length")
  if (method !== "GET" && length !== null && /^\d+$/u.test(length) && Number(length) > bodyLimit) {
    void request.body?.cancel().catch(() => {})
    return failure(413, "mori_request_body_too_large", requestId)
  }
  const controller = new AbortController()
  const aborted = () => controller.abort(request.signal.reason)
  request.signal.addEventListener("abort", aborted, { once: true })
  if (request.signal.aborted) aborted()
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = (milliseconds: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(new Error("Mori upstream deadline exceeded")), Math.max(0, milliseconds))
  }
  const cleanup = () => {
    clearTimeout(timer)
    request.signal.removeEventListener("abort", aborted)
  }
  const headers = new Headers({
    cookie, origin: config.origin,
    "x-kokoro-request-id": requestId, "x-kokoro-service": "web-bff", "x-kokoro-internal-secret": config.secret,
    "accept-encoding": "identity",
  })
  for (const name of ["accept", "content-type", "idempotency-key", "last-event-id", "range", "if-range"]) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  let readingRequest = false
  try {
    let body: ArrayBuffer | undefined
    if (method !== "GET") {
      budget(upload ? 120_000 : Math.min(5_000, 30_000 - (Date.now() - started)))
      readingRequest = true
      body = await boundedBody(request.body, bodyLimit, controller.signal)
      readingRequest = false
    }
    budget(upload ? 30_000 : 30_000 - (Date.now() - started))
    controller.signal.throwIfAborted()
    const fetching = fetch(`${config.base}/v1/mori/${path.map(encodeURIComponent).join("/")}${url.search}`, {
      method, headers, body, cache: "no-store", redirect: "manual", signal: controller.signal,
    })
    // Native fetch observes abort; also retire a late custom transport response.
    void fetching.then((late) => { if (controller.signal.aborted) void late.body?.cancel().catch(() => {}) }, () => {})
    const upstream = await abortable(fetching, controller.signal)
    const responseHeaders = new Headers()
    const connectionHeaders = new Set((upstream.headers.get("connection") ?? "").toLowerCase().split(",").map((name) => name.trim()))
    upstream.headers.forEach((value, name) => {
      if (!hopByHopHeaders.has(name) && !connectionHeaders.has(name)) responseHeaders.set(name, value)
    })
    if (!connectionHeaders.has("set-cookie"))
      for (const value of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", value)
    responseHeaders.set("cache-control", "no-store")
    responseHeaders.set("x-request-id", connectionHeaders.has("x-request-id") ? requestId : upstream.headers.get("x-request-id") ?? requestId)
    const contentType = upstream.headers.get("content-type") ?? ""
    const streaming = method === "GET" && /^(?:audio\/|image\/|video\/|application\/octet-stream(?:;|$)|text\/event-stream(?:;|$))/iu.test(contentType)
    if (!streaming || upstream.body === null) {
      // Ordinary replies remain bounded through EOF, including error replies.
      const bytes = await boundedBody(upstream.body, MiB, controller.signal)
      cleanup()
      return new Response(upstream.body === null ? null : bytes, { status: upstream.status, headers: responseHeaders })
    }
    clearTimeout(timer)
    const reader = upstream.body.getReader()
    let ended = false
    let downstream!: ReadableStreamDefaultController<Uint8Array>
    const finish = () => {
      ended = true
      cleanup()
      controller.signal.removeEventListener("abort", streamAborted)
      reader.releaseLock()
    }
    const streamAborted = () => {
      if (ended) return
      void reader.cancel().catch(() => {})
      finish()
      downstream.error(controller.signal.reason)
    }
    const stream = new ReadableStream<Uint8Array>({
      start(output) {
        downstream = output
        controller.signal.addEventListener("abort", streamAborted, { once: true })
        if (controller.signal.aborted) streamAborted()
      },
      async pull(output) {
        budget(60_000)
        try {
          const next = await abortable(reader.read(), controller.signal)
          clearTimeout(timer)
          if (ended) return
          if (next.done) { finish(); output.close() }
          else output.enqueue(next.value)
        } catch (error) {
          if (ended) return
          void reader.cancel().catch(() => {})
          finish()
          controller.abort(error)
          output.error(error)
        }
      },
      cancel(reason) {
        if (ended) return
        void reader.cancel(reason).catch(() => {})
        finish()
        controller.abort(reason)
      },
    }, { highWaterMark: 0 })
    return new Response(stream, { status: upstream.status, headers: responseHeaders })
  } catch (error) {
    controller.abort(error)
    cleanup()
    return readingRequest && error instanceof Error && error.message === "mori_request_body_too_large"
      ? failure(413, "mori_request_body_too_large", requestId)
      : failure(503, "mori_bff_unavailable", requestId)
  }
}
