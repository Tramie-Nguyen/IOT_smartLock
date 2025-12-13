import express from "express";
const router = express.Router();

import { changeLockPassword } from "./controller.js";

router.post("/change-lock-password", changeLockPassword);

export default router;