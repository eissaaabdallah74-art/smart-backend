require('dotenv').config();
const db = require("./src/models");

(async () => {
  try {
    await db.sequelize.authenticate();
    const queryInterface = db.sequelize.getQueryInterface();
    const tableName = 'drivers';

    const columns = await queryInterface.describeTable(tableName);

    // Drop the camelCase ones if they exist
    if (columns.isBlacklisted) await queryInterface.removeColumn(tableName, 'isBlacklisted');
    if (columns.blacklistReason) await queryInterface.removeColumn(tableName, 'blacklistReason');
    if (columns.blacklistedAt) await queryInterface.removeColumn(tableName, 'blacklistedAt');

    const { DataTypes } = require("sequelize");

    // Add the snake_case ones
    if (!columns.is_blacklisted) {
      await queryInterface.addColumn(tableName, 'is_blacklisted', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    }
    if (!columns.blacklist_reason) {
      await queryInterface.addColumn(tableName, 'blacklist_reason', { type: DataTypes.TEXT, allowNull: true });
    }
    if (!columns.blacklisted_at) {
      await queryInterface.addColumn(tableName, 'blacklisted_at', { type: DataTypes.DATE, allowNull: true });
    }

    console.log("DB fixed.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
