import type { NextConfig } from "next";

// Catatan: `cacheComponents` sengaja tidak diaktifkan. Hampir semua halaman
// sistem ini bergantung pada sesi dan status peminjaman yang harus selalu
// terbaru, sehingga rendering dinamis per-request lebih aman dan lebih mudah
// dipelihara.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
