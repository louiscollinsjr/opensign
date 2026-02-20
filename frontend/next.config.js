/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// In development the API falls back to http://localhost:3000.
// In production it talks to the Fly.io backend.
const devApiOrigins = isDev ? 'http://localhost:3000 ws://localhost:3000' : '';

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
              `connect-src 'self' https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com https://unpkg.com ${devApiOrigins}`.trim(),
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
