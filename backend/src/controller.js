import { publishToEsp } from "./mqtt.js";
import axios from "axios";
import qs from "qs";
import User from "./models/User.js";
import jwt from "jsonwebtoken";

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
        console.error("Error changing lock password:", error);
        return res.status(500).json({ message: "Internal server error." });
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

// @desc    Send password reset email
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

    // Generate reset token
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // In a real app, you would send an email here
    // For now, we'll just return the token (NOT secure for production)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.status(200).json({
      success: true,
      message: 'Password reset instructions sent to your email',
      // Remove this in production - only for testing
      resetToken: resetToken
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

export { changeLockPassword, pushNotification, signup, signin, forgotPassword, resetPassword, getProfile };