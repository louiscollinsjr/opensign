const { put, del } = require('@vercel/blob');

async function uploadPdf(filename, buffer, contentType = 'application/pdf') {
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType,
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });
  return { url: blob.url, key: blob.pathname };
}

async function deletePdf(key) {
  await del(key, { token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN });
}

module.exports = { uploadPdf, deletePdf };
