import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: trace from repo root so Next finds workspace deps (@tacko/telemetry-core, @tacko/telemetry-next)
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};
export default nextConfig;
