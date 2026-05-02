const sequelize = require('./src/config/db.config');

async function clean() {
  try {
    console.log('Dropping tables...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.query('DROP TABLE IF EXISTS employee_device_mappings');
    await sequelize.query('DROP TABLE IF EXISTS attendance_raw_logs');
    await sequelize.query('DROP TABLE IF EXISTS attendance_device_users');
    await sequelize.query('DROP TABLE IF EXISTS attendance_devices');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Tables dropped successfully.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

clean();
