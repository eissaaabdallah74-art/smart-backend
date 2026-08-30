const { sequelize } = require("./src/models");
const { DataTypes } = require("sequelize");

async function migrate() {
  try {
    console.log("Checking and adding replacement_custody_type to custodies table...");
    const queryInterface = sequelize.getQueryInterface();

    const tableInfo = await queryInterface.describeTable("custodies");
    if (!tableInfo.replacement_custody_type) {
      console.log("Adding replacement_custody_type column...");
      await queryInterface.addColumn("custodies", "replacement_custody_type", {
        type: DataTypes.STRING(100),
        allowNull: true,
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
