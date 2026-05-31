const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');
const { sequelize } = require('../src/models');

const orchestrator = require('../src/services/ai/ai-orchestrator.service');

async function runTests() {
    console.log('Starting Chatbot Smoke Tests...');

    const adminUser = { id: 1, role: 'admin', fullName: 'Test Admin' };
    const nonAdminUser = { id: 2, role: 'hr', fullName: 'Test HR' };

    const testNid = '29710312100233';

    // 1. Admin - Courier lookup by NID
    console.log('\n--- TEST 1: Admin - NID Lookup ---');
    const res1 = await orchestrator.ask(`هاتلي المندوب اللي رقم بطاقته ${testNid}`, adminUser);
    console.log('Result 1 Answer:', res1.answer);
    console.log('Model Used:', res1.model);

    // 2. Admin - Who is owner of NID (Global Search)
    console.log('\n--- TEST 2: Admin - Global NID Search ---');
    const res2 = await orchestrator.ask(`مين صاحب الرقم القومي ${testNid}`, adminUser);
    console.log('Result 2 Answer:', res2.answer);

    // 3. Admin - Courier ID lookup
    console.log('\n--- TEST 3: Admin - ID Lookup ---');
    const res3 = await orchestrator.ask('هاتلي المندوب رقم 198', adminUser);
    console.log('Result 3 Answer:', res3.answer);

    // 4. Non-Admin check
    // The orchestrator itself has some role checks inside it
    // but the main block is at the route level. 
    // Let's see if orchestrator blocks non-admins for driver data.
    console.log('\n--- TEST 4: Non-Admin - Permission Check ---');
    const res4 = await orchestrator.ask(`هاتلي المندوب اللي رقم بطاقته ${testNid}`, nonAdminUser);
    console.log('Result 4 Answer:', res4.answer);

    await sequelize.close();
    console.log('\nTests completed.');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
