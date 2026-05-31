const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Middleware to restrict access to Admins only
 */
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'غير مصرح لك باستخدام الشات.'
    });
};

// All chatbot routes require authentication and Admin role
router.post('/ask', authMiddleware, adminOnly, chatbotController.ask);
router.get('/health', authMiddleware, adminOnly, chatbotController.health);

module.exports = router;
