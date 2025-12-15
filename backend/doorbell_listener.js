// npm install mqtt nodemailer dotenv mongoose

const mqtt = require('mqtt');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB User Schema
const userSchema = new mongoose.Schema({
  fullName: String,
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  password: String,
  isVerified: Boolean,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  verificationToken: String,
  verificationTokenExpire: Date
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

// MQTT Configuration
const MQTT_BROKER = 'mqtt://broker.hivemq.com:1883';
const DOORBELL_TOPIC = 'home/doorbell';

// Email Configuration from .env
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
};

const EMAIL_FROM = process.env.EMAIL_FROM || '"Smart Lock Doorbell" <noreply@smartlock.com>';

// Create email transporter
const transporter = nodemailer.createTransporter(EMAIL_CONFIG);

// MongoDB connection
async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Get user emails from database
async function getUserEmails() {
  try {
    const users = await User.find({ isVerified: true }, 'email');
    return users.map(user => user.email);
  } catch (error) {
    console.error('Error fetching user emails:', error);
    return [];
  }
}

// Create MQTT client
const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: 'DoorbellListener-' + Math.random().toString(16).substr(2, 8),
  keepalive: 60,
  reconnectPeriod: 1000,
  connectTimeout: 30 * 1000
});

// MQTT connection handler
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker:', MQTT_BROKER);
  console.log('Subscribing to doorbell topic:', DOORBELL_TOPIC);
  
  mqttClient.subscribe(DOORBELL_TOPIC, (err) => {
    if (err) {
      console.error('Failed to subscribe to topic:', err);
    } else {
      console.log('Successfully subscribed to doorbell notifications');
      console.log('Email notifications ready');
      console.log('Waiting for doorbell events...\n');
    }
  });
});

// MQTT message handler
mqttClient.on('message', async (topic, message) => {
  if (topic === DOORBELL_TOPIC) {
    const messageStr = message.toString();
    const timestamp = new Date().toLocaleString();
    
    console.log('Guest at the door!');
    console.log('Time:', timestamp);
    console.log('Topic:', topic);
    console.log('Message:', messageStr);
    
    // Get user emails from database
    const userEmails = await getUserEmails();
    
    if (userEmails.length > 0) {
      // Send email notification to all users
      try {
        for (const email of userEmails) {
          await sendDoorbellEmail(email, timestamp, messageStr);
        }
        console.log('Email notifications sent to', userEmails.length, 'users\n');
      } catch (error) {
        console.error('Failed to send email notifications:', error.message, '\n');
      }
    } else {
      console.log('No verified users found for email notifications\n');
    }
  }
});

// MQTT error handler
mqttClient.on('error', (error) => {
  console.error('MQTT Error:', error);
});

// MQTT disconnect handler
mqttClient.on('close', () => {
  console.log('MQTT connection closed');
});

// MQTT reconnect handler
mqttClient.on('reconnect', () => {
  console.log('Reconnecting to MQTT broker...');
});

// Email sending function
async function sendDoorbellEmail(emailTo, timestamp, message) {
  const mailOptions = {
    from: EMAIL_FROM,
    to: emailTo,
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

  const info = await transporter.sendMail(mailOptions);
  console.log('Email sent to', emailTo, '- Message ID:', info.messageId);
  return info;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down doorbell listener...');
  mqttClient.end();
  mongoose.disconnect();
  process.exit(0);
});

// Process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize the application
async function initialize() {
  console.log('Smart Lock Doorbell Backend Listener Starting...');
  console.log('Configuration:');
  console.log('   MQTT Broker:', MQTT_BROKER);
  console.log('   Doorbell Topic:', DOORBELL_TOPIC);
  console.log('   Email Service:', EMAIL_CONFIG.service);
  console.log('Connecting to MongoDB...');
  
  await connectToMongoDB();
  
  console.log('Connecting to MQTT broker...');
}

// Start the application
initialize().catch(console.error);