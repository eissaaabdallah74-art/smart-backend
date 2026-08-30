const { sequelize } = require("./src/models");
const { DataTypes } = require("sequelize");

async function migrate() {
  try {
    console.log("Checking and adding total_qty to custody_items table...");
    const queryInterface = sequelize.getQueryInterface();

    const tableInfo = await queryInterface.describeTable("custody_items");
    if (!tableInfo.total_qty) {
      console.log("Adding total_qty column...");
      await queryInterface.addColumn("custody_items", "total_qty", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
