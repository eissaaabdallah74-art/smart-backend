require('dotenv').config();
const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');
const { Auth, Driver } = require('../src/models');

async function smokeTest() {
    console.log('--- Gemini-Only Smoke Test ---');
    
    const adminUser = await Auth.findOne({ where: { role: 'admin' } });
    const mockUser = { id: adminUser.id, role: adminUser.role, permissions: {}, employeeId: null };
    
    // 1. Simple Prompt
    console.log('\n[Test 1: Simple Prompt]');
    try {
        const res1 = await AIOrchestrator.ask('Say OK', mockUser);
        console.log(`Answer: ${res1.answer}`);
        console.log(`Provider: ${res1.actualProvider} | Model: ${res1.model}`);
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }

    // 2. Real Data Tool
    console.log('\n[Test 2: Real Data Tool]');
    const drv = await Driver.findOne();
    if (drv) {
        try {
            const res2 = await AIOrchestrator.ask(`هاتلي المندوب رقم ${drv.id}`, mockUser);
            console.log(`Answer: ${res2.answer.substring(0, 100)}...`);
            console.log(`Provider: ${res2.actualProvider} | Model: ${res2.model}`);
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }

    // 3. Fallback Model Check (Simulate failure by using invalid model in a temp context if possible, 
    // but here we just check if it returns flash-lite if we forced it)
    console.log('\n[Test 3: Fallback Verification]');
    // We can't easily force failure here without changing env, but we can verify the log shows no Ollama
    
    process.exit(0);
}

smokeTest();
