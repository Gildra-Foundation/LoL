import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Изображения уже оптимизированы на CDN Riot — отдаём как есть.
  images: { unoptimized: true },
  // Общий движок лежит в packages/engine исходниками TypeScript — Next собирает его вместе с сайтом.
  transpilePackages: ['@rift/engine'],
};

export default nextConfig;
