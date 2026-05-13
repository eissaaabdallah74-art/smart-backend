// src/routes/chat.routes.js
const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.get("/history", chatController.getChatHistory);
router.get("/contacts", chatController.getRecentContacts);
router.post("/read", chatController.markAsRead);

module.exports = router;
