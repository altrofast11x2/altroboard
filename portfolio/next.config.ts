import type { NextConfig } from "next";

// Content-Security-Policy: 데이터 URL(이미지), Firebase, GitHub 등 외부 도메인 허용.
// 인라인 스크립트는 Next.js 가 strict-dynamic 으로 처리 못하므로 'unsafe-inline' 으로 일단 유지하되,
// XSS 의 핵심 차단은 React JSX 가 기본적으로 텍스트를 이스케이프함 + lib/security.js 의 입력 검증.
// Firebase Realtime DB 가 long-polling fallback 으로 동적 <script> 태그를 만들어
// 자신의 도메인(*.firebasedatabase.app) 에서 스크립트를 로드한다 → script-src 에 명시 필수.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebasedatabase.app https://*.firebaseio.com https://*.googleapis.com https://api.anthropic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.firebaseio.com https://*.firebasedatabase.app https://*.googleapis.com https://api.github.com https://github.com https://soundcloud.com https://api.soundcloud.com https://open.er-api.com https://api.anthropic.com wss://*.firebaseio.com wss://*.firebasedatabase.app",
  "frame-src 'self' https://w.soundcloud.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ')

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',   value: CSP },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
};

export default nextConfig;
