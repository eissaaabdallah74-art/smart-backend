const AIOrchestrator = require('../src/services/ai/ai-orchestrator.service');
const { sequelize } = require('../src/models');

async function runTests() {
    console.log('Starting Global Search Runtime Tests...');

    const adminUser = { id: 1, role: 'admin', fullName: 'Test Admin' };
    const testNid = '29710312100233'; // From previous DB check

    // 1. Search by existing NID
    console.log('\n--- TEST 1: Existing NID ---');
    const res1 = await AIOrchestrator.ask(`مين صاحب الرقم القومي ${testNid}`, adminUser);
    console.log('Result 1 Answer:', res1.answer);

    // 2. Search by missing NID
    console.log('\n--- TEST 2: Missing NID ---');
    const res2 = await AIOrchestrator.ask('مين صاحب الرقم القومي 12345678901234', adminUser);
    console.log('Result 2 Answer:', res2.answer);

    // 3. Search by name
    console.log('\n--- TEST 3: Search by name ---');
    const res3 = await AIOrchestrator.ask('ابحث عن اسم Ahmed gabr', adminUser);
    console.log('Result 3 Answer:', res3.answer);

    // 4. "Who am I?" query
    console.log('\n--- TEST 4: Who am I? ---');
    const res4 = await AIOrchestrator.ask('انت عارف انا مين؟', adminUser);
    console.log('Result 4 Answer:', res4.answer);

    await sequelize.close();
    console.log('\nTests completed.');
}

runTests().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
