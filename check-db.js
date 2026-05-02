const sequelize = require('./src/config/db.config');

async function check() {
  try {
    const [results] = await sequelize.query('DESCRIBE employees');
    console.log('--- EMPLOYEES TABLE ---');
    console.table(results);
    
    try {
      const [results2] = await sequelize.query('DESCRIBE attendance_devices');
      console.log('--- ATTENDANCE DEVICES TABLE ---');
      console.table(results2);
    } catch (e) {
      console.log('Attendance devices table does not exist yet.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

check();
