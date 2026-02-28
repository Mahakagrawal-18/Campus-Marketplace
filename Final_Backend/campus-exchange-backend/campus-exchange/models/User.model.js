const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@iitj\.ac\.in$/,
        'Only @iitj.ac.in email addresses are allowed',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    rollNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    // hostel: {
    //   type: String,
    //   enum: ['Aravalli', 'Vindhya', 'Shivalik', 'Nilgiri', 'Himgiri', 'Thar', 'Other'],
    // },
    profilePicture: {
      type: String,
      default: '',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationOTP: String,
    emailVerificationOTPExpire: Date,
    passwordResetOTP: String,
    passwordResetOTPExpire: Date,
    refreshToken: String,

    // Trust score system
    trustScore: {
      type: Number,
      default: 50.0,
      min: 0,
      max: 500,
    },
    totalRatingsReceived: {
      type: Number,
      default: 0,
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    successfulTransactions: {
      type: Number,
      default: 0,
    },
    successfulPurchase: {
      type: Number,
      default: 0
    },
    failedTransactions:{
      type: Number,
      Default:0
    },
    

    successfulSales: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Recalculate trust score after new review
userSchema.methods.updateTrustScore = async function (newRating) {
  const total = this.totalRatingsReceived * this.trustScore + newRating;
  this.totalRatingsReceived += 1;
  this.trustScore = parseFloat((total / this.totalRatingsReceived).toFixed(2));
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
