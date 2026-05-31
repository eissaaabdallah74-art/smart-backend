require('dotenv').config();
const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');
const { AIUsageLog, Auth } = require('../src/models');

async function verify() {
    console.log('--- AI Runtime Verification ---');
    console.log('Provider:', process.env.AI_PROVIDER);
    
    // 1. Get a mock user (Admin or any user from DB)
    const user = await Auth.findOne({ where: { role: 'admin' } });
    if (!user) {
        console.error('No admin user found in DB to run test.');
        process.exit(1);
    }
    
    const mockUser = {
        id: user.id,
        role: user.role,
        permissions: {},
        employeeId: null
    };

    console.log(`Testing with User ID: ${mockUser.id} (${mockUser.role})`);

    try {
        console.log(`Configured Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
        console.log(`API Key exists: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`);

        // 2. Test Gemini Request
        console.log('Sending request to AI Orchestrator (Say OK)...');
        const start = Date.now();
        const result = await AIOrchestrator.ask('Say OK', mockUser);
        const end = Date.now();
        
        console.log('Response received in', end - start, 'ms');
        console.log('Actual Provider:', result.actualProvider);
        console.log('Fallback Used:', result.fallbackUsed);
        console.log('Answer:', result.answer);

        // 3. Verify Log
        const latestLog = await AIUsageLog.findOne({
            order: [['createdAt', 'DESC']]
        });

        if (latestLog) {
            console.log('Usage Log Entry Found:');
            console.log(` - Provider: ${latestLog.provider}`);
            console.log(` - Model: ${latestLog.model}`);
            console.log(` - Status: ${latestLog.status}`);
            console.log(` - Latency: ${latestLog.latencyMs}ms`);
        }
    } catch (error) {
        console.error('Verification Failed:', error.message);
    }

    process.exit(0);
}

verify();
