import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@kokoro/i18n", "@kokoro/web-core"],
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
