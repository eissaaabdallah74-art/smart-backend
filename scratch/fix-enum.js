const { sequelize } = require('../src/models');

async function fixEnum() {
  try {
    await sequelize.query("ALTER TABLE kpi_elements MODIFY COLUMN calculation_type ENUM('account_manager_target', 'account_manager_day1', 'interviewer_recruitment', 'manual', 'operation_team_target', 'supply_chain_team_target') NOT NULL");
    console.log('✅ Enum updated successfully');
  } catch (error) {
    console.error('❌ Error updating enum:', error);
  } finally {
    process.exit();
  }
}

fixEnum();
