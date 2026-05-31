const AIOrchestrator = require('../services/ai/ai-orchestrator.service');

/**
 * Chatbot Controller - Production Hardened
 * Delegates complex logic to AIOrchestrator and provides health checks.
 */
exports.ask = async (req, res) => {
    try {
        const { message, legacyContext } = req.body;
        const user = req.user;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const result = await AIOrchestrator.ask(message, user, legacyContext);
        
        return res.json({
            success: true,
            ...result,
            // Compatibility aliases for legacy frontend versions
            answer: result.answer,
            reply: result.answer,
            response: result.answer,
            suggestions: ['موظفين الـ CRM', 'ملخص المالية', 'قائمة العملاء', 'المهام المعلقة']
        });
    } catch (error) {
        console.error('[Chatbot Controller Error]:', error);
        return res.status(500).json({
            success: false,
            error: 'AI assistant is temporarily unavailable',
            message: 'حدث خطأ في قراءة البيانات. جرب مرة أخرى.'
        });
    }
};

exports.health = async (req, res) => {
    try {
        // Simple role check (assumes req.user is populated by auth middleware)
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized. Admin only.' });
        }

        const health = AIOrchestrator.getHealth();
        return res.json({
            success: true,
            health
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};