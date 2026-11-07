import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/payment-batch-receipts/[id]/pdf": ["./public/fonts/DejaVuSans.ttf"],
    "/api/payment-batches/*/notice/pdf": ["./public/fonts/DejaVuSans.ttf"],
    "/api/payment-batches/notice/pdf": ["./public/fonts/DejaVuSans.ttf"],
    "/api/tuition-receipts/[id]/pdf": ["./public/fonts/DejaVuSans.ttf"],
    "/api/classes/[id]/tuition-notice/pdf": ["./public/fonts/DejaVuSans.ttf"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
