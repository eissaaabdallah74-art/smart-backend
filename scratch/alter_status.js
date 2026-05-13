require('dotenv').config();
const db = require('../src/models');
(async () => {
  try {
    await db.sequelize.query("ALTER TABLE attendance_monthly_summaries MODIFY COLUMN status ENUM('draft', 'locked', 'paid') NOT NULL DEFAULT 'draft';");
    console.log('ALTERED');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
