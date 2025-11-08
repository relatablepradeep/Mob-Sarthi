/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/scaler/:path*',
        destination: 'http://localhost:4000/scaler/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
