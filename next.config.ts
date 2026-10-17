import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.TICKETERA_BUILD_TARGET === "lambda" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
