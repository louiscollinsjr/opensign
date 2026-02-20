const { Resend } = require('resend');

const FROM = 'Opensign <noreply@atem.gdn>';

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendSigningInvite({ recipientName, recipientEmail, envelopeTitle, signingUrl }) {
  return getClient().emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `Please sign: ${envelopeTitle}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#111;">
        <h2 style="font-size:18px;font-weight:600;margin:0 0 8px;">You have a document to sign</h2>
        <p style="color:#555;margin:0 0 24px;">Hi ${recipientName}, <strong>${envelopeTitle}</strong> is ready for your signature.</p>
        <a href="${signingUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">Review &amp; Sign</a>
        <p style="color:#999;font-size:12px;margin:32px 0 0;">This link is unique to you. Do not share it.</p>
      </div>
    `,
  });
}

async function sendCompletionNotice({ ownerEmail, ownerName, envelopeTitle, signedPdfUrl }) {
  const downloadBlock = signedPdfUrl
    ? `<p style="margin:24px 0 0;"><a href="${signedPdfUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">Download signed PDF</a></p>`
    : '';
  return getClient().emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Signed: ${envelopeTitle}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#111;">
        <h2 style="font-size:18px;font-weight:600;margin:0 0 8px;">Document fully signed</h2>
        <p style="color:#555;margin:0;">Hi ${ownerName}, all parties have signed <strong>${envelopeTitle}</strong>.</p>
        ${downloadBlock}
      </div>
    `,
  });
}

module.exports = { sendSigningInvite, sendCompletionNotice };
