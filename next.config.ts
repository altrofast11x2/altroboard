import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverActions: { bodySizeLimit: '52mb' },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // XSS 방어
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // 클릭재킹 방어
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // MIME 스니핑 방어
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer 정보 제한
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 외부 스크립트 실행 제한 (인라인은 허용 — Next.js 필요)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.vercel-storage.com https://assets.mixkit.co",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
