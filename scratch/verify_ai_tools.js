require('dotenv').config();
const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');
const { Auth, Driver, Client } = require('../src/models');

async function verify() {
    console.log('--- AI Tools Verification (Gemini-Only) ---');
    
    const adminUser = await Auth.findOne({ where: { role: 'admin' } });
    const mockUser = { id: adminUser.id, role: adminUser.role, permissions: {}, employeeId: null };
    
    const existingDriver = await Driver.findOne();
    const existingClient = await Client.findOne();

    const tests = [
        { name: 'Gemini Basic Prompt', prompt: 'مرحبا' },
        { name: 'Courier 360 Profile', prompt: existingDriver ? `هاتلي بيانات المندوب رقم ${existingDriver.id}` : 'هاتلي المندوب 1' },
        { name: 'Operations Report', prompt: 'تقرير تشغيل' },
        { name: 'Company Overview', prompt: existingClient ? `ملخص شركة رقم ${existingClient.id}` : 'ملخص شركة 1' }
    ];

    for (const test of tests) {
        console.log(`\n[Test: ${test.name}]`);
        console.log(`Prompt: ${test.prompt}`);
        try {
            const result = await AIOrchestrator.ask(test.prompt, mockUser);
            console.log(`Status: SUCCESS | Provider: ${result.actualProvider} | Model: ${result.model}`);
            console.log(`Answer: ${result.answer.substring(0, 150)}...`);
        } catch (e) {
            console.error(`Status: FAILED - ${e.message}`);
        }
    }

    process.exit(0);
}

verify();
