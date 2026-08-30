const { Sequelize } = require('sequelize');
const dbConfig = require('./src/config/db.config.js');

async function migrate() {
  try {
    console.log('Migrating client_pricings table...');
    await dbConfig.query('ALTER TABLE client_pricings ADD COLUMN hub_ids JSON DEFAULT NULL;');
    console.log('Added hub_ids');
    await dbConfig.query('ALTER TABLE client_pricings ADD COLUMN zone_ids JSON DEFAULT NULL;');
    console.log('Added zone_ids');
    console.log('Migration completed successfully.');
  } catch (error) {
    if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist. Skipping.');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    process.exit(0);
  }
}

migrate();
