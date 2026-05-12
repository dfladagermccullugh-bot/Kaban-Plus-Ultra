import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kpu/ui', '@kpu/core', '@kpu/db'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
