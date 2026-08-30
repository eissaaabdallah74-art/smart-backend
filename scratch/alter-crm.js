const { sequelize } = require('../src/models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    await sequelize.query(`
      ALTER TABLE interviews
      ADD COLUMN crm_day1_status VARCHAR(50) NULL DEFAULT NULL,
      ADD COLUMN crm_day1_approved_at DATE NULL DEFAULT NULL;
    `);

    console.log('Columns added successfully');
  } catch (err) {
    if (err.message.includes('Duplicate column name')) {
      console.log('Columns already exist');
    } else {
      console.error('Error:', err);
    }
  } finally {
    process.exit(0);
  }
}

main();
