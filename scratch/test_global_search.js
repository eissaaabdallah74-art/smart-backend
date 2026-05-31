const globalSearchTools = require('../src/services/ai/tools/global-search-ai.tools');
const { sequelize } = require('../src/models');

async function testSearch() {
    const user = { role: 'admin' };

    console.log('--- Test 1: National ID search (14 digits) ---');
    // I need a real NID from DB or just check if it correctly builds the query
    // Let's try a fake one first to see if it doesn't crash
    const res1 = await globalSearchTools.globalSearch('29201010101010', null, user);
    console.log('Result 1:', JSON.stringify(res1, null, 2));

    console.log('\n--- Test 2: Phone search ---');
    const res2 = await globalSearchTools.globalSearch('01012345678', null, user);
    console.log('Result 2:', JSON.stringify(res2, null, 2));

    console.log('\n--- Test 3: Name search ---');
    const res3 = await globalSearchTools.globalSearch('احمد', null, user);
    console.log('Result 3:', JSON.stringify(res3, null, 2));

    console.log('\n--- Test 4: Courier ID search ---');
    const res4 = await globalSearchTools.globalSearch('1', 'Driver', user);
    console.log('Result 4:', JSON.stringify(res4, null, 2));
    
    await sequelize.close();
}

testSearch().catch(err => {
    console.error(err);
    process.exit(1);
});
