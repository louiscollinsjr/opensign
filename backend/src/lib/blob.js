const { put, del } = require('@vercel/blob');

// Accept either name — Fly.io secret is BLOB_READ_WRITE_TOKEN,
// local .env and Vercel use VERCEL_BLOB_READ_WRITE_TOKEN
const BLOB_TOKEN =
  process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
  process.env.BLOB_READ_WRITE_TOKEN;

async function uploadPdf(filename, buffer, contentType = 'application/pdf') {
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType,
    token: BLOB_TOKEN,
  });
  return { url: blob.url, key: blob.pathname };
}

async function deletePdf(key) {
  await del(key, { token: BLOB_TOKEN });
}

module.exports = { uploadPdf, deletePdf };
