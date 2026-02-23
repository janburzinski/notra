import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true, // enabled by default but I like to be explicit
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/*": ["./src/lib/ai/skills/**/*"],
  },
  experimental: {
    useCache: true,
    optimizePackageImports: ["@hugeicons/core-free-icons", "lucide-react"],
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  transpilePackages: ["@notra/db", "@notra/ui", "@notra/email"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: process.env.CLOUDFLARE_PUBLIC_URL
      ? [
          {
            protocol: new URL(
              process.env.CLOUDFLARE_PUBLIC_URL
            ).protocol.replace(":", "") as "https" | "http",
            hostname: new URL(process.env.CLOUDFLARE_PUBLIC_URL).hostname,
          },
        ]
      : [],
  },
};

export default nextConfig;
