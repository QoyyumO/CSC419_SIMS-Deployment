import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack config for SVG handling with @svgr/webpack
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  // Empty turbopack config to silence warning when using webpack
  turbopack: {},
};

export default nextConfig;
