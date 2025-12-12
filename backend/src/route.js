const express = require("express");
const router = express.Router();

const { changeLockPassword } = require("./controller.js");

router.post("/change-lock-password", changeLockPassword);

module.exports = router;