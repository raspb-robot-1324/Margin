import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth + per-user documents — keep fully dynamic.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
