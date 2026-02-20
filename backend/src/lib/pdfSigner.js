/**
 * pdfSigner.js
 *
 * Fetches the original PDF from Vercel Blob, embeds all signed field values
 * using pdf-lib, and returns the modified PDF bytes.
 *
 * Coordinate convention stored in DB:
 *   x, y, width, height  — all in [0,1] as fractions of the rendered page size.
 *   pdf-lib uses points from the BOTTOM-LEFT, so we convert:
 *     pdfX = x * pageWidth
 *     pdfY = pageHeight - (y * pageHeight) - (height * pageHeight)
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Convert a base64 dataURL (data:image/png;base64,...) to a Uint8Array.
 * Canvas.toDataURL() always produces PNG.
 */
function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

/**
 * Download raw bytes from a URL (Vercel Blob public URL).
 */
async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Embed all field values into the PDF and return the signed PDF bytes.
 *
 * @param {string} pdfUrl   - Public URL of the original PDF in Vercel Blob
 * @param {Array}  fields   - Field documents from MongoDB (with .value set)
 * @returns {Uint8Array}    - Bytes of the signed PDF
 */
async function embedSignatures(pdfUrl, fields) {
  const pdfBytes = await fetchBytes(pdfUrl);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    if (!field.value) continue; // skip unfilled optional fields

    // pdf-lib pages are 0-indexed; DB pages are 1-indexed
    const pageIndex = (field.page || 1) - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert fractional coords → points (bottom-left origin)
    const pdfX = field.x * pageWidth;
    const fieldHeightPt = field.height * pageHeight;
    const fieldWidthPt = field.width * pageWidth;
    // y coord: flip from top-left (stored) to bottom-left (pdf-lib)
    const pdfY = pageHeight - (field.y * pageHeight) - fieldHeightPt;

    const isDataUrl = field.value.startsWith('data:');

    if (isDataUrl) {
      // Signature or initials: embed as a PNG image
      try {
        const imgBytes = dataUrlToBytes(field.value);
        const img = await pdfDoc.embedPng(imgBytes);
        page.drawImage(img, {
          x: pdfX,
          y: pdfY,
          width: fieldWidthPt,
          height: fieldHeightPt,
        });
      } catch (err) {
        console.error(`[pdfSigner] Failed to embed image for field ${field._id}:`, err.message);
      }
    } else {
      // Text field (name, email, date, text): draw as a string
      const fontSize = Math.max(8, Math.min(12, fieldHeightPt * 0.55));
      const text = String(field.value);
      try {
        page.drawText(text, {
          x: pdfX + 2,
          // Vertically centre the text within the field box
          y: pdfY + (fieldHeightPt - fontSize) / 2,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
          maxWidth: fieldWidthPt - 4,
        });
      } catch (err) {
        console.error(`[pdfSigner] Failed to draw text for field ${field._id}:`, err.message);
      }
    }
  }

  return pdfDoc.save();
}

module.exports = { embedSignatures };
