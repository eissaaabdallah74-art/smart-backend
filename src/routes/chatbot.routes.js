const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');

router.post('/ask', chatbotController.ask);

module.exports = router;
