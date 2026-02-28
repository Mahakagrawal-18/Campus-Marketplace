const User = require('../models/User.model');
const Listing = require('../models/Listing.model');
const Review = require('../models/Review.model');

// GET /api/users/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// PUT /api/users/me
exports.updateMe = async (req, res) => {
  const allowed = ['name', 'phone', 'hostel', 'profilePicture', 'rollNumber'];
  const updates = {};
  allowed.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, user });
};

// PUT /api/users/me/change-password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
};

// GET /api/users/:id  — public profile
exports.getUserProfile = async (req, res) => {
  const user = await User.findById(req.params.id).select(
    'name hostel profilePicture trustScore totalRatingsReceived totalTransactions successfulTransactions createdAt'
  );
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const activeListings = await Listing.find({ seller: user._id, status: 'Available' }).select(
    'title price category condition images createdAt'
  );

  const reviews = await Review.find({ reviewee: user._id })
    .populate('reviewer', 'name profilePicture')
    .sort('-createdAt')
    .limit(10);

  res.json({ success: true, user, activeListings, reviews });
};
