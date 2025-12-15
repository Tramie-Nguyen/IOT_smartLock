import nodemailer from 'nodemailer';

// Create transporter based on environment
const createTransporter = () => {
  // Always use real email sending now
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send verification code email
export const sendVerificationCode = async (email, verificationCode, fullName) => {
  try {
    console.log(`📧 Sending email to ${email}...`);
    
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Smart Lock System" <cthhuy23@clc.fitus.edu.vn>',
      to: email,
      subject: 'Smart Lock - Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">🔐 Smart Lock System</h1>
            </div>
            
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Hello ${fullName},
            </p>
            
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
              We received a request to reset your password for your Smart Lock System account. 
              Use the verification code below to reset your password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #2563eb; color: white; font-size: 32px; font-weight: bold; padding: 20px 40px; border-radius: 8px; letter-spacing: 8px;">
                ${verificationCode}
              </div>
            </div>
            
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              <strong>Important:</strong>
            </p>
            <ul style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 30px;">
              <li>This code will expire in <strong>10 minutes</strong></li>
              <li>Don't share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email from Smart Lock System. Please do not reply.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        Smart Lock System - Password Reset
        
        Hello ${fullName},
        
        We received a request to reset your password for your Smart Lock System account.
        
        Your verification code is: ${verificationCode}
        
        This code will expire in 10 minutes.
        
        If you didn't request this, please ignore this email.
        
        --
        Smart Lock System
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('❌ Email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default { sendVerificationCode };