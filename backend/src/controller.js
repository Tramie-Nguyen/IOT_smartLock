import { publishToEsp } from "./mqtt.js";
import axios from "axios";
import qs from "qs";
import User from "./models/User.js";
import jwt from "jsonwebtoken";
import { sendVerificationCode } from "./services/emailService.js";
import nodemailer from "nodemailer";

const pushNotification = async (message) => {
  const payload = {
    t: "Smart Lock Alert",
    d: 'a',
    m: message,
    s: 1,
    v: 2,
    k: process.env.PUSHSAFER_KEY
  };

  try {
    const response = await axios.post(
      "https://www.pushsafer.com/api",
      qs.stringify(payload), // convert to x-www-form-urlencoded
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("Push sent:", response.data);
  } catch (err) {
    console.error("Push failed:", err.response?.data || err);
  }
};

const sendDoorbellEmail = async (timestamp, message) => {
  try {
    // Get verified user emails from database
    const users = await User.find({ isVerified: true }, 'email');
    const userEmails = users.map(user => user.email);
    
    if (userEmails.length === 0) {
      console.log('No verified users found for doorbell email notifications');
      return;
    }

    // Create email transporter
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const emailFrom = process.env.EMAIL_FROM || '"Smart Lock Doorbell" <noreply@smartlock.com>';

    // Send email to all verified users
    for (const email of userEmails) {
      const mailOptions = {
        from: emailFrom,
        to: email,
        subject: 'Doorbell Ringing',
        text: `A guest is visiting!\n\nTime: ${timestamp}\nMessage: ${message}\n\nPlease check your door.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 10px; border-left: 5px solid #007bff;">
              <h2 style="color: #007bff; margin-top: 0;">Doorbell Alert</h2>
              <p style="font-size: 18px; color: #333;">
                <strong>A guest is visiting!</strong>
              </p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #666;">
                <strong>Time:</strong> ${timestamp}<br>
                <strong>Message:</strong> ${message}
              </p>
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <p style="margin: 0; color: #856404;">
                  Please check your door or security camera to see who is visiting.
                </p>
              </div>
            </div>
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
              This is an automated notification from your Smart Lock Doorbell System.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('Doorbell email sent to:', email);
    }
    
    console.log(`Doorbell email notifications sent to ${userEmails.length} users`);
  } catch (error) {
    console.error('Error sending doorbell email notifications:', error);
  }
};
const changeLockPassword = (req, res) => {
    try {
        const { oldLockPassword, newLockPassword } = req.body;
        
        if (!oldLockPassword || !newLockPassword) {
            return res.status(400).json({ message: "Old and new lock passwords are required." });
        }

        // kiểm tra mật khẩu (chỉ được là số và độ dài 4 tới 6 và chỉ toàn là số)
        if (!/^\d{4,6}$/.test(newLockPassword)) {
            return res.status(400).json({ message: "New lock password must be 4-6 digits and contain only numbers." });
        }

        // Gửi lệnh đổi mật khẩu cho ESP qua MQTT
        publishToEsp("051_428_475/esp/change_pw", JSON.stringify({oldPW: oldLockPassword, newPW: newLockPassword }));

        return res.status(200).json({ message: "Lock password change request sent." });
    } catch (error) {
        console.error("Change lock password error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// @desc    Lock the door remotely
// @route   POST /api/lock-door
// @access  Private
const lockDoor = (req, res) => {
    try {
        // Send lock command to ESP32 via MQTT
        publishToEsp("051_428_475/esp/door_control", "lock");

        console.log("Lock command sent to ESP32");
        
        return res.status(200).json({ 
            success: true,
            message: "Door lock command sent successfully",
            action: "LOCK"
        });
    } catch (error) {
        console.error("Lock door error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error while locking door" 
        });
    }
};

// @desc    Unlock the door remotely
// @route   POST /api/unlock-door
// @access  Private
const unlockDoor = (req, res) => {
    try {
        // Send unlock command to ESP32 via MQTT
        publishToEsp("051_428_475/esp/door_control", "unlock");

        console.log("Unlock command sent to ESP32");
        
        return res.status(200).json({ 
            success: true,
            message: "Door unlock command sent successfully",
            action: "UNLOCK"
        });
    } catch (error) {
        console.error("Unlock door error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error while unlocking door" 
        });
    }
};

// @desc    Get current door status
// @route   GET /api/door-status
// @access  Private
const getDoorStatus = (req, res) => {
    try {
        // Request status from ESP32 via MQTT
        publishToEsp("051_428_475/esp/status_request", JSON.stringify({
            command: "GET_STATUS",
            timestamp: new Date().toISOString(),
            userId: req.user?.id
        }));

        console.log("Door status request sent to ESP32");
        
        return res.status(200).json({ 
            success: true,
            message: "Door status request sent" 
        });
    } catch (error) {
        console.error("Get door status error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error while getting door status" 
        });
    }
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all fields'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      isVerified: true // For now, auto-verify users
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isVerified: user.isVerified
        },
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/signin
// @access  Public
const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before signing in'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isVerified: user.isVerified
        },
        token
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signin'
    });
  }
};

// @desc    Send password reset verification code
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email address'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = user.generateResetPasswordCode();
    await user.save();

    // Send verification code via email
    const emailResult = await sendVerificationCode(email, verificationCode, user.fullName);

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }

    console.log(`📧 Verification code sent to ${email}: ${verificationCode}`);
    if (emailResult.previewUrl) {
      console.log(`📧 Preview email: ${emailResult.previewUrl}`);
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email address. Please check your inbox.',
      data: {
        email: email,
        // For development/testing only - remove in production
        ...(process.env.NODE_ENV !== 'production' && {
          previewUrl: emailResult.previewUrl,
          verificationCode: verificationCode
        })
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing request'
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { verificationCode, newPassword, confirmPassword } = req.body;

    if (!verificationCode || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all fields'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: verificationCode,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Set new password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isVerified: user.isVerified
        },
        token
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resetting password'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving profile'
    });
  }
};

export { changeLockPassword, pushNotification, sendDoorbellEmail, signup, signin, forgotPassword, resetPassword, getProfile, lockDoor, unlockDoor, getDoorStatus };