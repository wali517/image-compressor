import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  experimental: {
    agentUpgrade: 'security',
  },
};

export default nextConfig;
