const express = require('express');
const Recipient = require('../models/Recipient');
const Envelope = require('../models/Envelope');
const Field = require('../models/Field');
const { sendCompletionNotice } = require('../lib/resend');
const { uploadPdf } = require('../lib/blob');
const { embedSignatures } = require('../lib/pdfSigner');
const User = require('../models/User');

const router = express.Router();

router.get('/:token', async (req, res) => {
  try {
    const recipient = await Recipient.findOne({ token: req.params.token });
    if (!recipient) return res.status(404).json({ error: 'Invalid signing link' });
    const envelope = await Envelope.findById(recipient.envelopeId);
    if (!envelope) return res.status(404).json({ error: 'Envelope not found' });
    if (envelope.status === 'draft') {
      return res.status(400).json({ error: 'Document has not been sent yet' });
    }
    const fields = await Field.find({ envelopeId: envelope._id, recipientId: recipient._id });
    res.json({
      envelope: { id: envelope._id, title: envelope.title, pdfUrl: envelope.pdfUrl, pageCount: envelope.pageCount },
      recipient: { id: recipient._id, name: recipient.name, email: recipient.email, status: recipient.status },
      fields,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:token', async (req, res) => {
  try {
    const recipient = await Recipient.findOne({ token: req.params.token });
    if (!recipient) return res.status(404).json({ error: 'Invalid signing link' });
    if (recipient.status === 'signed') {
      return res.status(400).json({ error: 'Already signed' });
    }
    const envelope = await Envelope.findById(recipient.envelopeId);
    if (!envelope || envelope.status === 'draft') {
      return res.status(400).json({ error: 'Document not available for signing' });
    }
    const { values } = req.body;
    if (!Array.isArray(values)) return res.status(400).json({ error: 'values must be an array' });

    // Save each field value
    for (const v of values) {
      await Field.findByIdAndUpdate(v.fieldId, { value: v.value });
    }

    recipient.status = 'signed';
    recipient.signedAt = new Date();
    await recipient.save();

    const allRecipients = await Recipient.find({ envelopeId: envelope._id });
    const allSigned = allRecipients.every((r) => r.status === 'signed');

    if (allSigned) {
      envelope.status = 'completed';

      // Generate the signed PDF and store it in Vercel Blob
      try {
        const allFields = await Field.find({ envelopeId: envelope._id });
        const signedBytes = await embedSignatures(envelope.pdfUrl, allFields);
        const signedFilename = `envelopes/${envelope._id}/signed-${Date.now()}.pdf`;
        const { url, key } = await uploadPdf(signedFilename, Buffer.from(signedBytes));
        envelope.signedPdfUrl = url;
        envelope.signedPdfKey = key;
      } catch (pdfErr) {
        // Don't block completion if PDF generation fails — log and continue
        console.error('[sign] Failed to generate signed PDF:', pdfErr.message);
      }

      await envelope.save();

      const owner = await User.findById(envelope.ownerId);
      if (owner) {
        await sendCompletionNotice({
          ownerEmail: owner.email,
          ownerName: owner.name,
          envelopeTitle: envelope.title,
          signedPdfUrl: envelope.signedPdfUrl,
        });
      }
    }

    res.json({ ok: true, allSigned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
