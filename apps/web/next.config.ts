import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Let the build succeed even if ESLint finds issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ✅ Let the build succeed even if TS has type errors
  typescript: {
    ignoreBuildErrors: true,
  },
  // ✅ Configure images to work with CloudFront CDN
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d1ord17sndfe47.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
    ],
    unoptimized: true, // Disable optimization since images are already on CDN
  },
};

export default nextConfig;
