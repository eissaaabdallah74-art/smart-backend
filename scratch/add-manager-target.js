const { sequelize } = require('../src/models');

async function addColumn() {
  try {
    await sequelize.query('ALTER TABLE user_kpi_configs ADD COLUMN manager_rollup_target DECIMAL(10,2) NULL');
    console.log('Column added successfully');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    process.exit();
  }
}

addColumn();
