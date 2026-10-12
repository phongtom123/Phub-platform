import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["169.254.83.107"],
  // Include ui/shared, while each application keeps its own Next.js version.
  turbopack: { root: path.resolve(__dirname, "../..") },
};

export default nextConfig;
