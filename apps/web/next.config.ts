import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oneid/ui", "@oneid/shared"],
  // No personal data in URLs, headers or logs.
  // Strict CSP and security headers will be added in Phase 3.
};

export default nextConfig;
