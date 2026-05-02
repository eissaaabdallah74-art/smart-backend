const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsapp.controller");

// Core
router.get("/status", whatsappController.getStatus);
router.get("/progress", whatsappController.getProgress);
router.post("/connect", whatsappController.connect);
router.post("/logout", whatsappController.logout);
router.post("/send-bulk", whatsappController.sendBulk);

module.exports = router;
