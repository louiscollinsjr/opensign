const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    envelopeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Envelope', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipient', required: true },
    page: { type: Number, required: true, min: 1 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    type: {
      type: String,
      enum: ['signature', 'initials', 'name', 'email', 'date', 'text'],
      required: true,
    },
    required: { type: Boolean, default: true },
    value: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Field', fieldSchema);
