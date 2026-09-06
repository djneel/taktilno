import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536, 1920],
    // Разрешаем оптимизацию изображений, загруженных через админку (/api/media/*)
    localPatterns: [{ pathname: "/api/media/**" }, { pathname: "/images/**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
