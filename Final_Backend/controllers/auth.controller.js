const User = require('../models/User.model');
const { generateOTP, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email.util');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.util');
const jwt = require('jsonwebtoken');

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, rollNumber, hostel } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      // If they registered but never verified, resend OTP instead of blocking
      if (!existing.isEmailVerified) {
        const otp = generateOTP();
        existing.emailVerificationOTP       = otp;
        existing.emailVerificationOTPExpire = new Date(Date.now() + 10 * 60 * 1000);
        await existing.save();

        try {
          await sendVerificationEmail(email, existing.name, otp);
        } catch (emailErr) {
          console.error('Email send failed:', emailErr.message);
          return res.status(500).json({
            success: false,
            message: 'Account exists but OTP email failed to send. Check your SMTP settings in .env',
            debug: process.env.NODE_ENV === 'development' ? emailErr.message : undefined,
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Account already exists but was not verified. A new OTP has been sent to your email.',
        });
      }
      return res.status(400).json({ success: false, message: 'Email already registered and verified. Please login.' });
    }

    const otp       = generateOTP();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      name,
      email,
      password,
      rollNumber,
      hostel,
      emailVerificationOTP:       otp,
      emailVerificationOTPExpire: otpExpire,
    });

    // Send email — if this fails, delete the user so they can retry cleanly
    try {
      await sendVerificationEmail(email, name, otp);
    } catch (emailErr) {
      console.error('Email send failed during register:', emailErr.message);
      await User.findByIdAndDelete(user._id); // rollback
      return res.status(500).json({
        success: false,
        message: 'Registration failed: could not send OTP email. Please check your SMTP settings.',
        debug: process.env.NODE_ENV === 'development' ? emailErr.message : undefined,
      });
    }

    res.status(201).json({
      success: true,
      message: `Registration successful! OTP sent to ${email}. Check your inbox (and spam folder).`,
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration', error: err.message });
  }
};

// ─── Verify Email OTP ─────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user)              return res.status(404).json({ success: false, message: 'No account found for this email' });
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email is already verified. Please login.' });

    // Check OTP match first, then expiry (gives clearer error)
    if (user.emailVerificationOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please check and try again.' });
    }
    if (new Date(user.emailVerificationOTPExpire) < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    user.isEmailVerified              = true;
    user.emailVerificationOTP         = undefined;
    user.emailVerificationOTPExpire   = undefined;
    await user.save();

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken  = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified! Welcome to Campus Exchange.',
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)                return res.status(404).json({ success: false, message: 'No account found for this email' });
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email is already verified' });

    const otp = generateOTP();
    user.emailVerificationOTP       = otp;
    user.emailVerificationOTPExpire = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendVerificationEmail(email, user.name, otp);
    } catch (emailErr) {
      console.error('Resend OTP email failed:', emailErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Check SMTP settings.',
        debug: process.env.NODE_ENV === 'development' ? emailErr.message : undefined,
      });
    }

    res.json({ success: true, message: 'New OTP sent! Check your inbox and spam folder.' });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'This account has been banned' });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first. Check your inbox or request a new OTP.',
        requiresVerification: true,
      });
    }

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken  = refreshToken;
    await user.save();

    res.json({ success: true, accessToken, refreshToken, user: sanitizeUser(user) });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token provided' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const newAccessToken = generateAccessToken(user._id);
    res.json({ success: true, accessToken: newAccessToken });
  } catch {
    res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    req.user.refreshToken = undefined;
    await req.user.save();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether email exists
      return res.json({ success: true, message: 'If that email is registered, an OTP has been sent.' });
    }

    const otp = generateOTP();
    user.passwordResetOTP       = otp;
    user.passwordResetOTPExpire = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(email, user.name, otp);
    } catch (emailErr) {
      console.error('Forgot password email failed:', emailErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset OTP. Check SMTP settings.',
        debug: process.env.NODE_ENV === 'development' ? emailErr.message : undefined,
      });
    }

    res.json({ success: true, message: 'If that email is registered, an OTP has been sent.' });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid request' });
    if (user.passwordResetOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }
    if (new Date(user.passwordResetOTPExpire) < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    user.password               = newPassword;
    user.passwordResetOTP       = undefined;
    user.passwordResetOTPExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── Helper: strip sensitive fields ──────────────────────────────────────────
const sanitizeUser = (user) => ({
  _id:                  user._id,
  name:                 user.name,
  email:                user.email,
  rollNumber:           user.rollNumber,
  hostel:               user.hostel,
  profilePicture:       user.profilePicture,
  trustScore:           user.trustScore,
  totalRatingsReceived: user.totalRatingsReceived,
  totalTransactions:    user.totalTransactions,
  isEmailVerified:      user.isEmailVerified,
});