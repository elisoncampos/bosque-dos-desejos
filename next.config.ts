import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: {
    "/api/**": ["./drizzle/**/*"],
  },
  outputFileTracingExcludes: {
    "/api/**": [".data/**/*"],
  },
};

export default nextConfig;
