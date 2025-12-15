import express from 'express';
import { 
  signup, 
  signin, 
  forgotPassword, 
  resetPassword, 
  getProfile,
  lockDoor,
  unlockDoor,
  getDoorStatus,
  changeLockPassword
} from './controller.js';
import { protect } from './middleware/auth.js';

const router = express.Router();

// Authentication routes
router.post('/signup', signup);
router.post('/signin', signin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (require authentication)
router.get('/profile', protect, getProfile);
router.post('/lock', protect, lockDoor);
router.post('/unlock', protect, unlockDoor);
router.get('/door-status', protect, getDoorStatus);
router.post('/change-password', protect, changeLockPassword);

export default router;