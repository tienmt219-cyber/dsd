import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/dreamteam.html",
        headers: [
          { key: "Content-Type", value: "text/html; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
