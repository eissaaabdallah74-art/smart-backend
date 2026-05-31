const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Rate limiter for AI Chatbot endpoint.
 * 30 requests per 15 minutes per user/IP.
 */
const chatbotRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        message: 'Too many requests from this IP, please try again after 15 minutes',
        status: 429
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use user ID if available, otherwise fallback to official IP generator
        if (req.user?.id) return `user:${req.user.id}`;
        return ipKeyGenerator(req.ip);
    }
});

module.exports = { chatbotRateLimiter };
