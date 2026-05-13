const { sequelize } = require('../src/models');

async function cleanIndexes() {
  try {
    const [results] = await sequelize.query('SHOW INDEX FROM employee_attendance_profiles');
    
    // We want to drop indexes that have a number suffix or are redundant
    const toDrop = results
      .filter(r => r.Key_name !== 'PRIMARY' && (r.Key_name.includes('_') || r.Key_name === 'attendance_emp_no' || r.Key_name === 'attendance_ac_no'))
      .map(r => r.Key_name);

    // Keep unique names to avoid double dropping
    const uniqueToDrop = [...new Set(toDrop)];

    console.log(`Cleaning ${uniqueToDrop.length} redundant indexes...`);

    for (const indexName of uniqueToDrop) {
      try {
        await sequelize.query(`ALTER TABLE employee_attendance_profiles DROP INDEX \`${indexName}\``);
        console.log(` - Dropped: ${indexName}`);
      } catch (e) {
        console.error(` - Failed to drop ${indexName}:`, e.message);
      }
    }

    console.log('✅ Database cleanup finished.');
    process.exit();
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanIndexes();
