/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // archiver uses CommonJS exports that webpack 5 mis-resolves.
  // Mark it (and firebase-admin, which has the same issue) as external
  // for server bundling so Node loads them at runtime instead.
  experimental: {
    serverComponentsExternalPackages: ["archiver", "firebase-admin"],
  },
  // Force every HTML response to bypass the browser HTTP cache.
  // Combined with the kill-switch service worker, this guarantees that
  // updates land on the next refresh — no stale bundles on iPad / installed PWAs.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
