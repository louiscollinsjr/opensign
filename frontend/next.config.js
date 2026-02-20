/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// Allow localhost API calls during local development only
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
              // No unpkg needed — pdfjs worker is self-hosted at /pdf.worker.min.mjs
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Vercel Blob serves PDFs from *.public.blob.vercel-storage.com
              "img-src 'self' data: blob: https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com",
              // API calls + Vercel Blob fetches; localhost added in dev only
              `connect-src 'self' https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com ${devApiOrigins}`.trim(),
              "font-src 'self' data:",
              "frame-src 'self' blob:",
              // Worker served from same origin (/pdf.worker.min.mjs)
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
