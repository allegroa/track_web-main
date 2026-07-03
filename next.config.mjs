/** @type {import('next').NextConfig} */
const frameAncestors = (
  process.env.DATAVIZ_FRAME_ANCESTORS ||
  'http://localhost:5173 http://127.0.0.1:5173 http://192.168.1.140:5173'
)
  .split(/\s+/)
  .filter(Boolean)
  .join(' ');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors 'self' ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
