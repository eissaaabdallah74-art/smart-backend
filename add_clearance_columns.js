const { sequelize } = require("./src/models");
const { DataTypes } = require("sequelize");

async function migrate() {
  try {
    console.log("Checking and adding clearance columns to database...");
    const queryInterface = sequelize.getQueryInterface();

    // 1. Check & Add clearance_period_days to clients
    const clientsInfo = await queryInterface.describeTable("clients");
    if (!clientsInfo.clearance_period_days) {
      console.log("Adding clearance_period_days to clients table...");
      await queryInterface.addColumn("clients", "clearance_period_days", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      });
    }

    // 2. Check & Add inactive_date to drivers
    const driversInfo = await queryInterface.describeTable("drivers");
    if (!driversInfo.inactive_date) {
      console.log("Adding inactive_date to drivers table...");
      await queryInterface.addColumn("drivers", "inactive_date", {
        type: DataTypes.DATEONLY,
        allowNull: true,
      });
    }

    console.log("Clearance columns migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
