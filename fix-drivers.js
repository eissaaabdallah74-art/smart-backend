const db = require('./src/models');

async function fixDrivers() {
  try {
    await db.sequelize.query('ALTER TABLE drivers ADD COLUMN relative_name VARCHAR(150) NULL');
  } catch (e) { console.log('relative_name may already exist', e.message); }
  
  try {
    await db.sequelize.query('ALTER TABLE drivers ADD COLUMN relative_phone_number VARCHAR(40) NULL');
  } catch (e) { console.log('relative_phone_number may already exist', e.message); }
  
  try {
    await db.sequelize.query('ALTER TABLE drivers ADD COLUMN contract_location_type ENUM("company", "courier") DEFAULT "company"');
  } catch (e) { console.log('contract_location_type may already exist', e.message); }
  
  // contract_location_courier_id already exists based on previous output
  
  console.log('Done fixing drivers table.');
  process.exit(0);
}

fixDrivers();
