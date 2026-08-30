const sequelize = require('./src/config/db.config');

async function alterEnums() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    await sequelize.query(`ALTER TABLE ops_hr_requests MODIFY COLUMN status ENUM('pending', 'in_progress', 'requires_action', 'approved', 'rejected', 'enlisted') DEFAULT 'pending';`);
    console.log('Altered ops_hr_requests');

    await sequelize.query(`ALTER TABLE interviews MODIFY COLUMN signed_with_hr ENUM('Signed A Contract With HR', 'Will Think About Our Offers', 'Missing documents', 'Unqualified', 'hiring from hold');`);
    console.log('Altered interviews');

    await sequelize.query(`ALTER TABLE drivers MODIFY COLUMN signed_with_hr ENUM('Signed A Contract With HR', 'Will Think About Our Offers', 'Missing documents', 'Unqualified', 'hiring from hold');`);
    console.log('Altered drivers');

    console.log('All done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

alterEnums();
