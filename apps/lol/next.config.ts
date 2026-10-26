import path from 'node:path';
import type { NextConfig } from 'next';
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output
const nextConfig: NextConfig = {
  output: 'standalone',
  skipProxyUrlNormalize: true,
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'ddragon.leagueoflegends.com', pathname: '/cdn/img/champion/centered/**', search: '' }],
    formats: ['image/webp'],
    minimumCacheTTL: 86400,
  },
  transpilePackages: ['@rift/engine'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ] },
    ];
  },
};
export default nextConfig;
