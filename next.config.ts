import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Camera + geolocation require a secure context; Next handles HTTPS in prod (Vercel).
  // Keep server actions/body limits sane for CSV uploads.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
