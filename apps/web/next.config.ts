import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mubitracker/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
