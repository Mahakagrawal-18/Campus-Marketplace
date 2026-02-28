const nodemailer = require('nodemailer');

// ─── CRITICAL FIX: Create transporter lazily (inside function), NOT at module
// load time. At module load, process.env values from .env aren't ready yet if
// dotenv hasn't been called. Creating it lazily guarantees env vars are loaded.
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,          // false = STARTTLS on port 587
    requireTLS: true,       // CRITICAL: force TLS upgrade — without this Gmail rejects silently
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD, // Must be a Gmail App Password, NOT your login password
    },
    tls: {
      rejectUnauthorized: false, // Allows self-signed certs in dev
    },
  });
}

// ─── Verify SMTP connection (call this on server startup) ────────────────────
exports.verifyEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ SMTP email connection verified');
    return true;
  } catch (err) {
    console.error('❌ SMTP email connection FAILED:', err.message);
    console.error('   Check your SMTP_EMAIL, SMTP_PASSWORD (use Gmail App Password), SMTP_HOST in .env');
    return false;
  }
};

// ─── Generate 6-digit OTP ────────────────────────────────────────────────────
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─── Send verification OTP ───────────────────────────────────────────────────
exports.sendVerificationEmail = async (email, name, otp) => {
  const transporter = createTransporter();

  // CRITICAL FIX: FROM must be your actual Gmail address, not a custom domain
  // Gmail ignores the display name and uses your authenticated account as sender
  const fromAddress = process.env.SMTP_EMAIL;
  const fromName    = process.env.FROM_NAME || 'Campus Exchange';

  const info = await transporter.sendMail({
    from:    `"${fromName}" <${fromAddress}>`,
    to:      email,
    subject: 'Campus Exchange — Verify Your Email',
    text: `Hi ${name},\n\nYour OTP is: ${otp}\n\nIt expires in 10 minutes.\n\nIf you didn't register, ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:-0.5px;">
                      Campus<span style="color:#90caf9;">Exchange</span>
                    </h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                      IIT Jodhpur Marketplace
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="margin:0 0 12px;color:#1e293b;font-size:16px;">Hi <strong>${name}</strong>,</p>
                    <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                      Use the OTP below to verify your <strong>@iitj.ac.in</strong> email address.
                      It expires in <strong>10 minutes</strong>.
                    </p>

                    <!-- OTP Box -->
                    <div style="background:#f1f5f9;border:2px dashed #1a73e8;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                      <p style="margin:0 0 8px;color:#64748b;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
                      <div style="font-size:42px;font-weight:700;letter-spacing:14px;color:#1a73e8;font-family:'Courier New',monospace;">
                        ${otp}
                      </div>
                    </div>

                    <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
                      If you didn't create a Campus Exchange account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">
                      Campus Exchange — Secure Marketplace for IIT Jodhpur Students
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  console.log(`✅ Verification OTP sent to ${email} | MessageId: ${info.messageId}`);
  return info;
};

// ─── Send password reset OTP ─────────────────────────────────────────────────
exports.sendPasswordResetEmail = async (email, name, otp) => {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_EMAIL;
  const fromName    = process.env.FROM_NAME || 'Campus Exchange';

  const info = await transporter.sendMail({
    from:    `"${fromName}" <${fromAddress}>`,
    to:      email,
    subject: 'Campus Exchange — Password Reset OTP',
    text: `Hi ${name},\n\nYour password reset OTP is: ${otp}\n\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:linear-gradient(135deg,#c62828,#b71c1c);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;">
                      Campus<span style="color:#ffcdd2;">Exchange</span>
                    </h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Password Reset</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="margin:0 0 12px;color:#1e293b;font-size:16px;">Hi <strong>${name}</strong>,</p>
                    <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
                      Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.
                    </p>
                    <div style="background:#fff5f5;border:2px dashed #c62828;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                      <p style="margin:0 0 8px;color:#64748b;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Password Reset OTP</p>
                      <div style="font-size:42px;font-weight:700;letter-spacing:14px;color:#c62828;font-family:'Courier New',monospace;">
                        ${otp}
                      </div>
                    </div>
                    <p style="margin:0;color:#94a3b8;font-size:13px;">
                      If you didn't request this, your account is safe — just ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">Campus Exchange — IIT Jodhpur</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  console.log(`✅ Password reset OTP sent to ${email} | MessageId: ${info.messageId}`);
  return info;
};
