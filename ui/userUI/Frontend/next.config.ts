import type { NextConfig } from "next";
import path from "node:path";

const mediaBucketUrl = "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media";
const siteMediaUrl = `${mediaBucketUrl}/site`;
const productMediaUrl = `${mediaBucketUrl}/products`;
const rootMediaAssets = ["favicon.ico", "file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["169.254.83.107"],
  images: {
    minimumCacheTTL: 86_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "btfhahnjydaiivvcqnna.supabase.co",
        pathname: "/storage/v1/object/public/media/products/**",
      },
    ],
  },
  // Include ui/shared, while each application keeps its own Next.js version.
  turbopack: { root: path.resolve(__dirname, "../..") },
  async rewrites() {
    return [
      { source: "/images/:path*", destination: `${productMediaUrl}/:path*` },
      { source: "/icons/:path*", destination: `${siteMediaUrl}/icons/:path*` },
      ...rootMediaAssets.map((asset) => ({
        source: `/${asset}`,
        destination: `${siteMediaUrl}/${asset}`,
      })),
    ];
  },
};

export default nextConfig;
