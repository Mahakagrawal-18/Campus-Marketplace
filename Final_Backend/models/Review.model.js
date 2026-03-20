const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      maxlength: [500, 'Review comment cannot exceed 500 characters'],
      default: '',
    },
    // Was this reviewer the buyer or seller in the transaction?
    reviewerRole: {
      type: String,
      enum: ['buyer', 'seller'],
      required: true,
    },
  },
  { timestamps: true }
);

// One review per reviewer per transaction
reviewSchema.index({ transaction: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
