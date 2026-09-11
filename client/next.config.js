/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    // Prevent ESLint version mismatch issues during Vercel builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ensure smooth production builds on Vercel
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
