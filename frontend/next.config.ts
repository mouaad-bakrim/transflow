import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  // Type checking is run explicitly by the build script before Next compiles.
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
