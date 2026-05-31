require('dotenv').config();
const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');
const { Auth } = require('../src/models');

async function testHardening() {
    console.log('--- AI Hardening Verification ---');
    
    const adminUser = await Auth.findOne({ where: { role: 'admin' } });
    const mockUser = { id: adminUser.id, role: adminUser.role, permissions: {}, employeeId: null };

    // 1. Initial Health Check
    console.log('\n[Initial Health]');
    console.log(JSON.stringify(AIOrchestrator.getHealth(), null, 2));

    // 2. Simulate 3 Gemini Failures (by using a broken model)
    console.log('\n[Simulating 3 Gemini Failures]');
    process.env.GEMINI_MODEL = 'broken-model-test';
    const GeminiProvider = require('../src/services/ai/gemini.provider');
    GeminiProvider.modelName = 'broken-model-test'; // Force it
    
    for (let i = 1; i <= 3; i++) {
        console.log(`Failure ${i}...`);
        try {
            await AIOrchestrator.ask('Test failure', mockUser);
        } catch (e) {
            // expected
        }
    }

    // 3. Check Circuit Breaker status
    const health = AIOrchestrator.getHealth();
    console.log('\n[Health After Failures]');
    console.log(`Circuit Status: ${health.circuitBreaker.status}`);
    console.log(`Failures: ${health.circuitBreaker.failures}`);

    // 4. Test request during OPEN circuit
    console.log('\n[Test Request during OPEN circuit]');
    const result = await AIOrchestrator.ask('This should fallback immediately', mockUser);
    console.log(`Actual Provider: ${result.actualProvider}`);
    console.log(`Fallback Used: ${result.fallbackUsed}`);
    console.log(`Fallback Reason: ${result.fallbackReason}`);

    // 5. Restore config
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    GeminiProvider.modelName = 'gemini-2.5-flash';

    process.exit(0);
}

testHardening().catch(err => {
    console.error(err);
    process.exit(1);
});
