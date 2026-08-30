const { sequelize } = require('./src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    console.log('Adding trust receipts columns to interviews...');
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('interviews');

    if (!tableInfo.trust_receipts_count) {
      console.log('Adding trust_receipts_count to interviews table...');
      await queryInterface.addColumn('interviews', 'trust_receipts_count', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      });
    }

    if (!tableInfo.trust_receipts_amount) {
      console.log('Adding trust_receipts_amount to interviews table...');
      await queryInterface.addColumn('interviews', 'trust_receipts_amount', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
      });
    }

    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

migrate();
