const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Books', 'Electronics', 'Cycles', 'Hostel Essentials', 'Clothing', 'Sports', 'Stationery', 'Other'],
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    },
    images: [
      {
        url: String,
        publicId: String, // Cloudinary public_id
      },
    ],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Completed', 'Disputed', 'Removed'],
      default: 'Available',
    },
    // When Reserved or in escrow, track the buyer
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reservedAt: {
      type: Date,
      default: null,
    },
    // Auto-expire reservations after 24 hours
    reservationExpiresAt: {
      type: Date,
      default: null,
    },
    views: {
      type: Number,
      default: 0,
    },
    isNegotiable: {
      type: Boolean,
      default: false,
    },
    tags: [String],
  },
  { timestamps: true }
);

// Index for fast search
listingSchema.index({ title: 'text', description: 'text', tags: 'text' });
listingSchema.index({ category: 1, status: 1 });
listingSchema.index({ seller: 1 });
listingSchema.index({ price: 1 });

module.exports = mongoose.model('Listing', listingSchema);
