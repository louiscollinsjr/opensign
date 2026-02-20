const mongoose = require('mongoose');

const envelopeSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'sent', 'completed'], default: 'draft' },
    pdfUrl: { type: String, default: null },
    pdfKey: { type: String, default: null },
    pageCount: { type: Number, default: 1 },
    signedPdfUrl: { type: String, default: null },
    signedPdfKey: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Envelope', envelopeSchema);
