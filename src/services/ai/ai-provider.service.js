/**
 * Base AI Provider Service
 */
class AIProvider {
    async generateResponse(prompt, context = '') {
        throw new Error('generateResponse must be implemented by the provider');
    }

    async callTool(toolName, args) {
        throw new Error('callTool must be implemented by the provider');
    }
}

module.exports = AIProvider;
