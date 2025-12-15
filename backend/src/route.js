import express from "express";
const router = express.Router();

import { changeLockPassword, signup, signin, forgotPassword, resetPassword, getProfile, lockDoor, unlockDoor, getDoorStatus } from "./controller.js";
import { protect } from "./middleware/auth.js";

// Lock management routes
router.post("/change-lock-password", changeLockPassword);
router.post("/lock-door", protect, lockDoor);
router.post("/unlock-door", protect, unlockDoor);
router.get("/door-status", protect, getDoorStatus);

// Authentication routes
router.post("/auth/signup", signup);
router.post("/auth/signin", signin);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);
router.get("/auth/profile", protect, getProfile);

export default router;