const User = require('../models/User.model');
const { generateOTP, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email.util');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.util');
const jwt = require('jsonwebtoken');

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const { name, email, password, rollNumber, hostel } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const otp = generateOTP();
  const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  const user = await User.create({
    name,
    email,
    password,
    rollNumber,
    hostel,
    emailVerificationOTP: otp,
    emailVerificationOTPExpire: otpExpire,
  });

  await sendVerificationEmail(email, name, otp);

  res.status(201).json({
    success: true,
    message: 'Registration successful! Please check your @iitj.ac.in email for the OTP.',
  });
};

// ─── Verify Email OTP ─────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email already verified' });

  if (user.emailVerificationOTP !== otp || user.emailVerificationOTPExpire < Date.now()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  user.isEmailVerified = true;
  user.emailVerificationOTP = undefined;
  user.emailVerificationOTPExpire = undefined;
  await user.save();

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save();

  res.json({ success: true, message: 'Email verified successfully!', accessToken, refreshToken, user: sanitizeUser(user) });
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
exports.resendOTP = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email already verified' });

  const otp = generateOTP();
  user.emailVerificationOTP = otp;
  user.emailVerificationOTPExpire = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendVerificationEmail(email, user.name, otp);
  res.json({ success: true, message: 'OTP resent to your email' });
};

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  if (user.isBanned) return res.status(403).json({ success: false, message: 'Account banned' });
  if (!user.isEmailVerified) {
    return res.status(403).json({ success: false, message: 'Please verify your email first' });
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save();

  res.json({ success: true, accessToken, refreshToken, user: sanitizeUser(user) });
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const newAccessToken = generateAccessToken(user._id);
    res.json({ success: true, accessToken: newAccessToken });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  req.user.refreshToken = undefined;
  await req.user.save();
  res.json({ success: true, message: 'Logged out successfully' });
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Don't reveal if email exists
  if (!user) return res.json({ success: true, message: 'If that email is registered, an OTP has been sent.' });

  const otp = generateOTP();
  user.passwordResetOTP = otp;
  user.passwordResetOTPExpire = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendPasswordResetEmail(email, user.name, otp);
  res.json({ success: true, message: 'If that email is registered, an OTP has been sent.' });
};

// ─── Reset Password ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.passwordResetOTP !== otp || user.passwordResetOTPExpire < Date.now()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  user.password = newPassword;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpire = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successfully. Please log in.' });
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  rollNumber: user.rollNumber,
  hostel: user.hostel,
  profilePicture: user.profilePicture,
  trustScore: user.trustScore,
  totalRatingsReceived: user.totalRatingsReceived,
  totalTransactions: user.totalTransactions,
  isEmailVerified: user.isEmailVerified,
});
