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
  const bffBaseUrl = (process.env.KOKORO_BFF_URL ?? "http://127.0.0.1:4300").replace(/\/$/u, "")
  const target = `${bffBaseUrl}/v1/mori/${path.map((segment) => encodeURIComponent(segment)).join("/")}${new URL(request.url).search}`
  const headers = new Headers()
  for (const name of ["accept", "content-type", "idempotency-key", "last-event-id", "range", "if-range", "x-kokoro-request-id"]) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  headers.set("x-kokoro-service", "web-bff")
  headers.set("x-kokoro-internal-secret", process.env.KOKORO_BFF_SHARED_SECRET ?? "test-secret")
  headers.set("x-kokoro-namespace", process.env.KOKORO_BFF_NAMESPACE ?? "mori_local")
  headers.set("x-kokoro-principal-id", process.env.KOKORO_BFF_PRINCIPAL_ID ?? "local_user")

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
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json({
      error: {
        code: "mori_bff_unavailable",
        message: "Mori BFF is unavailable",
        retryable: true,
        details: null,
      },
      meta: { request_id: request.headers.get("x-kokoro-request-id") ?? crypto.randomUUID() },
    }, { status: 503 })
  }
}
