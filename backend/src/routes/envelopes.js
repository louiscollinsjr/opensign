const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Envelope = require('../models/Envelope');
const Recipient = require('../models/Recipient');
const Field = require('../models/Field');
const authMiddleware = require('../middleware/auth');
const { uploadPdf } = require('../lib/blob');
const { sendSigningInvite } = require('../lib/resend');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const envelopes = await Envelope.find({ ownerId: req.userId }).sort({ createdAt: -1 });
    res.json(envelopes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const envelope = await Envelope.create({ ownerId: req.userId, title });
    res.status(201).json(envelope);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Lightweight update for mutable envelope fields (currently: pageCount, title)
router.patch('/:id', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    if (req.body.pageCount != null) {
      const n = parseInt(req.body.pageCount, 10);
      if (!isNaN(n) && n > 0) envelope.pageCount = n;
    }
    if (req.body.title != null && req.body.title.trim()) {
      envelope.title = req.body.title.trim();
    }
    await envelope.save();
    res.json(envelope);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    const recipients = await Recipient.find({ envelopeId: envelope._id }).sort({ order: 1 });
    const fields = await Field.find({ envelopeId: envelope._id });
    res.json({ envelope, recipients, fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    if (envelope.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft envelopes can be deleted' });
    }
    await Field.deleteMany({ envelopeId: envelope._id });
    await Recipient.deleteMany({ envelopeId: envelope._id });
    await envelope.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/upload', upload.single('pdf'), async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = `envelopes/${envelope._id}/${Date.now()}.pdf`;
    const { url, key } = await uploadPdf(filename, req.file.buffer);
    const pageCount = req.body.pageCount ? parseInt(req.body.pageCount, 10) : 1;
    envelope.pdfUrl = url;
    envelope.pdfKey = key;
    envelope.pageCount = pageCount;
    await envelope.save();
    res.json({ pdfUrl: url, pdfKey: key, pageCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/recipients', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    const { recipients } = req.body;
    if (!Array.isArray(recipients)) return res.status(400).json({ error: 'recipients must be an array' });
    await Recipient.deleteMany({ envelopeId: envelope._id });
    const created = await Recipient.insertMany(
      recipients.map((r, i) => ({
        envelopeId: envelope._id,
        name: r.name,
        email: r.email,
        order: r.order ?? i,
        token: uuidv4(),
        status: 'pending',
      }))
    );
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/fields', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    const { fields } = req.body;
    if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields must be an array' });
    await Field.deleteMany({ envelopeId: envelope._id });
    const created = await Field.insertMany(
      fields.map((f) => ({
        envelopeId: envelope._id,
        recipientId: f.recipientId,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        type: f.type,
        required: f.required ?? true,
      }))
    );
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    // Allow resend when status is 'sent' (e.g. if email failed). Block only 'completed'.
    if (envelope.status === 'completed') {
      return res.status(400).json({ error: 'Envelope is already completed' });
    }
    if (!envelope.pdfUrl) {
      return res.status(400).json({ error: 'No PDF uploaded yet' });
    }
    const recipients = await Recipient.find({ envelopeId: envelope._id }).sort({ order: 1 });
    if (!recipients.length) {
      return res.status(400).json({ error: 'No recipients added' });
    }
    // On resend, only email recipients who haven't signed yet
    const pendingRecipients = envelope.status === 'sent'
      ? recipients.filter((r) => r.status !== 'signed')
      : recipients;
    const baseUrl = process.env.FRONTEND_URL || 'https://opensign-app.vercel.app';
    const emailErrors = [];
    for (const recipient of pendingRecipients) {
      const signingUrl = `${baseUrl}/sign/${recipient.token}`;
      try {
        const result = await sendSigningInvite({
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          envelopeTitle: envelope.title,
          signingUrl,
        });
        // Resend returns { data: { id }, error: null } on success
        if (result.error) {
          console.error(`[send] Resend error for ${recipient.email}:`, result.error);
          emailErrors.push({ email: recipient.email, error: result.error.message || JSON.stringify(result.error) });
        } else {
          console.log(`[send] Email sent to ${recipient.email}, id: ${result.data?.id}`);
        }
      } catch (emailErr) {
        console.error(`[send] Failed to send email to ${recipient.email}:`, emailErr.message);
        emailErrors.push({ email: recipient.email, error: emailErr.message });
      }
    }
    envelope.status = 'sent';
    await envelope.save();
    res.json({
      ok: true,
      status: 'sent',
      recipientCount: recipients.length,
      emailErrors: emailErrors.length ? emailErrors : undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Return per-recipient signing URLs — used by "Copy link" so the owner can
// share links manually without relying on email delivery.
router.get('/:id/links', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    if (envelope.status === 'draft') {
      return res.status(400).json({ error: 'Document has not been sent yet' });
    }
    const recipients = await Recipient.find({ envelopeId: envelope._id }).sort({ order: 1 });
    const baseUrl = process.env.FRONTEND_URL || 'https://opensign-app.vercel.app';
    const links = recipients.map((r) => ({
      recipientId: r._id,
      name: r.name,
      email: r.email,
      status: r.status,
      signingUrl: `${baseUrl}/sign/${r.token}`,
    }));
    res.json({ links });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Return the signed PDF URL for a completed envelope so the frontend can trigger a browser download
router.get('/:id/download', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!envelope) return res.status(404).json({ error: 'Not found' });
    if (envelope.status !== 'completed') {
      return res.status(400).json({ error: 'Document is not yet complete' });
    }
    if (!envelope.signedPdfUrl) {
      return res.status(404).json({ error: 'Signed PDF not available yet' });
    }
    res.json({ signedPdfUrl: envelope.signedPdfUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
