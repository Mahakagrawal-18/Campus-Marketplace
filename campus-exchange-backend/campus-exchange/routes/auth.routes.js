const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');
const auth = require('../controllers/auth.controller');

const emailRule = body('email')
  .isEmail().withMessage('Invalid email')
  .matches(/@iitj\.ac\.in$/).withMessage('Only @iitj.ac.in emails are allowed');

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  emailRule,
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
], auth.register);

router.post('/verify-email', [
  emailRule,
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  validate,
], auth.verifyEmail);

router.post('/resend-otp', [emailRule, validate], auth.resendOTP);

router.post('/login', [
  emailRule,
  body('password').notEmpty().withMessage('Password is required'),
  validate,
], auth.login);

router.post('/refresh-token', auth.refreshToken);
router.post('/logout', protect, auth.logout);

router.post('/forgot-password', [emailRule, validate], auth.forgotPassword);

router.post('/reset-password', [
  emailRule,
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
], auth.resetPassword);

module.exports = router;
