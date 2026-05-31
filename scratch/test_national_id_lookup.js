const db = require('../src/models');
const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');

async function test() {
    console.log("--- SMV National ID Lookup Test ---");

    const mockUser = {
        id: 1,
        role: 'admin',
        name: 'Admin User'
    };

    const testPrompts = [
        "هاتلي المندوب اللي رقم بطاقته 29710312100238",
        "المندوب رقم بطاقته 29710312100238 حالته إيه؟",
        "هاتلي المندوب اللي رقم بطاقته 00000000000000", // Non-existent
        "هاتلي المندوب رقم 1" // Should use ID, not NID
    ];

    for (const prompt of testPrompts) {
        console.log(`\nPrompt: "${prompt}"`);
        try {
            // We can't easily see the context from outside AIOrchestrator without modifying it.
            // But we can check the AIUsageLog afterwards.
            const result = await AIOrchestrator.ask(prompt, mockUser);
            console.log(`Response:\n${result.answer}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }

    process.exit(0);
}

test();
