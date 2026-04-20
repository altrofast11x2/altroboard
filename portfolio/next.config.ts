import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '52mb',
    },
  },
  // API Route body size limit 확대 (50MB 영상 업로드용)
  api: {
    bodyParser: {
      sizeLimit: '52mb',
    },
    responseLimit: '52mb',
  },
};

export default nextConfig;
