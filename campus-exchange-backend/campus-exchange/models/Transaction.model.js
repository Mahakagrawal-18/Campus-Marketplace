const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    agreedPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Escrow State Machine ─────────────────────────────────────────────────
    // Available → Reserved → Completed | Disputed
    status: {
      type: String,
      enum: ['Reserved', 'Completed', 'Disputed', 'Cancelled', 'Expired'],
      default: 'Reserved',
    },

    // Bilateral confirmation for completion
    sellerConfirmed: { type: Boolean, default: false },
    buyerConfirmed: { type: Boolean, default: false },
    sellerConfirmedAt: Date,
    buyerConfirmedAt: Date,

    // Dispute handling
    disputeRaisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    disputeReason: { type: String, default: '' },
    disputeRaisedAt: Date,
    disputeResolvedAt: Date,
    disputeResolution: { type: String, default: '' },

    // Meeting/handover notes (optional)
    meetingLocation: { type: String, default: '' },
    notes: { type: String, default: '' },

    // Auto-expiry
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },

    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

transactionSchema.index({ buyer: 1 });
transactionSchema.index({ seller: 1 });
transactionSchema.index({ listing: 1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
