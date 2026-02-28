const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Generate 6-digit OTP
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification OTP
exports.sendVerificationEmail = async (email, name, otp) => {
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Campus Exchange - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1a73e8;">Campus Exchange - IIT Jodhpur</h2>
        <p>Hi ${name},</p>
        <p>Your email verification OTP is:</p>
        <h1 style="letter-spacing: 8px; color: #1a73e8; text-align: center;">${otp}</h1>
        <p>This OTP expires in <strong>10 minutes</strong>.</p>
        <p>If you did not create an account, please ignore this email.</p>
        <hr/>
        <small style="color: #888;">Campus Exchange — Secure Marketplace for IIT Jodhpur Students</small>
      </div>
    `,
  });
};

// Send password reset OTP
exports.sendPasswordResetEmail = async (email, name, otp) => {
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Campus Exchange - Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1a73e8;">Campus Exchange - IIT Jodhpur</h2>
        <p>Hi ${name},</p>
        <p>Your password reset OTP is:</p>
        <h1 style="letter-spacing: 8px; color: #e53935; text-align: center;">${otp}</h1>
        <p>This OTP expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
    `,
  });
};
