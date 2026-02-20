/** @type {import('next').NextConfig} */

// Allow localhost origins for API/websocket during local dev even in prod builds used locally.
const localApiOrigins = 'http://localhost:3000 ws://localhost:3000';

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
              "style-src 'self' 'unsafe-inline'",
              // Vercel Blob serves from *.public.blob.vercel-storage.com
              `img-src 'self' data: blob: https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com`,
              // fetch() for PDFs, API calls, and pdfjs worker (CDN)
              // localhost origins are added in development only
              `connect-src 'self' https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com https://unpkg.com ${localApiOrigins}`.trim(),
              "font-src 'self' data:",
              // blob: needed for pdfjs canvas rendering
              "frame-src 'self' blob:",
              "worker-src 'self' blob: https://unpkg.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
