const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema(
  {
    envelopeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Envelope', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    order: { type: Number, default: 0 },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'signed'], default: 'pending' },
    signedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipient', recipientSchema);
