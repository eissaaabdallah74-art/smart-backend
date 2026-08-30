const db = require('./src/models');
db.sequelize.query("ALTER TABLE auth_users MODIFY COLUMN role ENUM('admin', 'crm', 'operation', 'hr', 'finance', 'supply_chain', 'poc') DEFAULT 'operation'")
  .then(() => {
    console.log('Enum updated');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
