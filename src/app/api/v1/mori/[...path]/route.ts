import { NextRequest } from "next/server"

export const runtime = "nodejs"

const hopByHopHeaders = new Set(["connection", "content-length", "keep-alive", "transfer-encoding"])

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

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST" | "PUT") {
  const { path } = await context.params
  const configuredBffUrl = process.env.KOKORO_BFF_URL?.trim() || "http://127.0.0.1:4300"
  const bffBaseUrl = configuredBffUrl.replace(/\/$/u, "")
  const target = `${bffBaseUrl}/v1/mori/${path.map((segment) => encodeURIComponent(segment)).join("/")}${new URL(request.url).search}`
  const requestId = request.headers.get("x-kokoro-request-id") ?? request.headers.get("x-request-id") ?? crypto.randomUUID()
  const headers = new Headers()
  for (const name of ["accept", "content-type", "idempotency-key", "last-event-id", "range", "if-range"]) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  const cookie = request.headers.get("cookie")
  if (cookie !== null) headers.set("cookie", cookie)
  headers.set("x-kokoro-request-id", requestId)
  headers.set("x-kokoro-service", "web-bff")
  const localFixtureBff = isLoopbackUrl(configuredBffUrl)
  const sharedSecret = process.env.KOKORO_BFF_SHARED_SECRET?.trim() || (localFixtureBff ? "test-secret" : null)
  const namespace = process.env.KOKORO_BFF_NAMESPACE?.trim() || (localFixtureBff ? "mori_local" : null)
  if (sharedSecret === null || namespace === null) {
    return Response.json({
      error: {
        code: "mori_bff_misconfigured",
        message: "Mori BFF connection is not configured",
        retryable: false,
        details: null,
      },
      meta: { request_id: requestId },
    }, { status: 503, headers: { "x-request-id": requestId } })
  }
  headers.set("x-kokoro-internal-secret", sharedSecret)
  headers.set("x-kokoro-namespace", namespace)
  const configuredPrincipalId = process.env.KOKORO_BFF_PRINCIPAL_ID?.trim()
  if (configuredPrincipalId) headers.set("x-kokoro-principal-id", configuredPrincipalId)

  let body: ArrayBuffer | undefined
  if (method !== "GET") body = await request.arrayBuffer()

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
    })
    const responseHeaders = new Headers()
    upstream.headers.forEach((value, name) => {
      if (!hopByHopHeaders.has(name.toLowerCase())) responseHeaders.set(name, value)
    })
    responseHeaders.set("x-request-id", upstream.headers.get("x-request-id") ?? requestId)
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json({
      error: {
        code: "mori_bff_unavailable",
        message: "Mori BFF is unavailable",
        retryable: true,
        details: null,
      },
      meta: { request_id: requestId },
    }, { status: 503, headers: { "x-request-id": requestId } })
  }
}

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
  } catch {
    return false
  }
}
