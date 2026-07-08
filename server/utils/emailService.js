const nodemailer = require('nodemailer');

const sendRecoveryEmail = async (toEmail, otpCode) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const mailOptions = {
    from: `"GetFit App" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'GetFit – Your Password Reset Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f0f0f; color: #ffffff; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6c63ff, #ff6584); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">GET<span style="color: #fff">FIT</span></h1>
          <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">Password Recovery</p>
        </div>
        <div style="padding: 36px 32px;">
          <p style="font-size: 16px; margin: 0 0 24px;">Hi Trainer,</p>
          <p style="font-size: 14px; color: #aaa; margin: 0 0 24px;">Use the code below to reset your password. This code expires in 1 hour.</p>
          <div style="background: #1a1a2e; border: 2px solid #6c63ff; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #aaa; letter-spacing: 2px; text-transform: uppercase;">Your Recovery Code</p>
            <span style="font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #6c63ff;">${otpCode}</span>
          </div>
          <p style="font-size: 12px; color: #666; margin: 0;">If you did not request a password reset, please ignore this email.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendRecoveryEmail };
