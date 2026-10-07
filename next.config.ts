import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents(부분 사전 렌더링)는 쓰지 않는다.
  // 켜면 params를 Suspense 안에서만 읽을 수 있는 등 규칙이 까다로워서, 이 프로젝트 규모에는 얻는 것보다 번거로움이 크다.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
