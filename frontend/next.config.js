/** @type {import('next').NextConfig} */
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
              "img-src 'self' data: blob: https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com",
              // fetch() for PDFs and API calls; unpkg for pdfjs worker
              "connect-src 'self' https://opensign-backend.fly.dev https://*.public.blob.vercel-storage.com https://unpkg.com",
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
