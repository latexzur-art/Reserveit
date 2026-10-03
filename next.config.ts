import type { NextConfig } from "next";

function isValidUpstashUrl(url: string | undefined): boolean {
  if (!url || url === "[SENSITIVE]" || url === "disabled" || url.startsWith("your_upstash")) {
    return false;
  }
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["@azure/identity"],
  cacheHandler: isValidUpstashUrl(process.env.UPSTASH_REDIS_REST_URL) ? require.resolve("./lib/cache-handler.js") : undefined,
  turbopack: {
    rules: {
      "**/*.{tsx,jsx}": {
        loaders: [{
          loader: "@locator/webpack-loader",
          options: { env: "development" }
        }]
      }
    }
  }
};

export default nextConfig;
