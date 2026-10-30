import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
