const nodemailer = require('nodemailer');

const requiredSettings = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];

const getTransporter = () => {
  const missing = requiredSettings.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw { status: 503, message: 'SMTP email service is not configured.' };
  }

  // Google App passwords require removing all spaces and hyphens
  const cleanPass = (process.env.SMTP_PASS || '').replace(/[\s-]/g, '');

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: cleanPass,
    },
  });
};

/**
 * Generate a responsive cyber/glassmorphism HTML email template
 */
const renderEmailTemplate = ({ title, preheader, bodyText, code, expiryText }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050814; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050814; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background: #0c1228; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(99,102,241,0.15)); border-bottom: 1px solid #1e293b;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                ⚡ EduNova
              </h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px; font-weight: 500;">
                Autonomous Adaptive Learning Architecture
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #f8fafc;">
                ${title}
              </h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                ${bodyText}
              </p>

              <!-- One-Time Code Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background: rgba(6, 182, 212, 0.08); border: 2px dashed #06b6d4; border-radius: 12px; padding: 18px 24px; display: inline-block;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
                ⏱️ ${expiryText}
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.4; color: #64748b; text-align: center;">
                If you did not request this security verification, please ignore this email or update your account security credentials.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; text-align: center; border-top: 1px solid #1e293b; background: #070b18;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} EduNova Learning Systems. Verified Production Environment.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Send 6-digit password reset OTP email
 */
const sendPasswordResetCode = async (email, code) => {
  const transporter = getTransporter();
  const html = renderEmailTemplate({
    title: 'Password Recovery Verification',
    preheader: `Your password reset code is ${code}`,
    bodyText: 'We received a request to reset your EduNova account password. Enter the one-time verification code below to securely configure your new password.',
    code,
    expiryText: 'This verification code is valid for 10 minutes and expires automatically.',
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: `🔐 ${code} is your EduNova password reset code`,
    text: `Your EduNova password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
    html,
  });
};

/**
 * Send 6-digit email verification OTP
 */
const sendEmailVerificationOtp = async (email, code) => {
  const transporter = getTransporter();
  const html = renderEmailTemplate({
    title: 'Verify Your Email Address',
    preheader: `Your email verification code is ${code}`,
    bodyText: 'Thank you for registering on EduNova! Please verify your email address to activate your full student access, AI Socratic tutor, and persistent progress tracking.',
    code,
    expiryText: 'This verification code is valid for 15 minutes.',
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: `⚡ ${code} is your EduNova email verification code`,
    text: `Your EduNova email verification code is ${code}. It expires in 15 minutes.`,
    html,
  });
};

module.exports = {
  sendPasswordResetCode,
  sendEmailVerificationOtp,
  getTransporter,
};
