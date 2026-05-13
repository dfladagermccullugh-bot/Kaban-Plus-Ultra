import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kpu/ui', '@kpu/core', '@kpu/db'],
  // `standalone` emits .next/standalone/server.js with only the required
  // node_modules tracing — the self-host Dockerfile copies that into a slim
  // runtime image instead of the full monorepo node_modules.
  output: 'standalone',
  // The standalone tracer starts from the app dir; tell it to walk up to the
  // workspace root so workspace deps (@kpu/*) are picked up.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
