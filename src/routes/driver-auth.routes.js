const express = require("express");
const router = express.Router();
const driverAuthController = require("../controllers/driver-auth.controller");

router.post("/check-phone", driverAuthController.checkPhone);
router.post("/verify-id", driverAuthController.verifyId);
router.post("/set-password", driverAuthController.setPassword);
router.post("/login", driverAuthController.login);

module.exports = router;
