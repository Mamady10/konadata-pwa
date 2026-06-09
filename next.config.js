/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Évite les conflits Server Actions quand plusieurs lockfiles existent sur la machine
  outputFileTracingRoot: path.join(__dirname),

  // optimizePackageImports sur react cassait le bundle middleware (self is not defined)
  serverExternalPackages: [
    '@supabase/ssr',
    '@supabase/supabase-js',
    '@napi-rs/canvas',
    'pdfjs-dist',
    'sharp',
  ],

  serverActions: {
    bodySizeLimit: '6mb',
  },

  webpack: (config, { isServer, webpack }) => {
    // Modules natifs (.node) — jamais dans le bundle navigateur
    if (!isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^@napi-rs\/canvas$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /\.node$/ })
      );
      config.resolve.alias = {
        ...config.resolve.alias,
        '@napi-rs/canvas': false,
      };
    }
    return config;
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 384, 640, 750, 828],
    imageSizes: [16, 32, 48, 64, 96, 128],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours
  },

  // En-têtes de cache agressifs pour assets statiques
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/offline.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
