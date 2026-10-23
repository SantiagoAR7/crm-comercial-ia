const apiUrl = process.env.NEXT_PUBLIC_API_URL;

const nextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  reactStrictMode: true,
  async rewrites() {
    if (!apiUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
