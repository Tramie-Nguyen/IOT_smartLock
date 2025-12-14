import express from "express";
const router = express.Router();

import { changeLockPassword, signup, signin, forgotPassword, resetPassword, getProfile } from "./controller.js";
import { protect } from "./middleware/auth.js";

// Lock management routes
router.post("/change-lock-password", changeLockPassword);

// Authentication routes
router.post("/auth/signup", signup);
router.post("/auth/signin", signin);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);
router.get("/auth/profile", protect, getProfile);

export default router;