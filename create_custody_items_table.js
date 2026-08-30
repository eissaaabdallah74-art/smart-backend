const { sequelize } = require("./src/models");
const { DataTypes } = require("sequelize");

async function migrate() {
  try {
    console.log("Checking and creating custody_items table...");
    const queryInterface = sequelize.getQueryInterface();

    // Create table custody_items if not exists
    await queryInterface.createTable("custody_items", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      serial_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("available", "assigned", "damaged", "lost"),
        allowNull: false,
        defaultValue: "available",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    console.log("Custody_items table created/verified successfully.");

    // Check and add custody_item_id to custodies
    const custodiesInfo = await queryInterface.describeTable("custodies");
    
    if (!custodiesInfo.custody_item_id) {
      console.log("Adding custody_item_id column to custodies table...");
      await queryInterface.addColumn("custodies", "custody_item_id", {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "custody_items",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!custodiesInfo.replacement_custody_item_id) {
      console.log("Adding replacement_custody_item_id column to custodies table...");
      await queryInterface.addColumn("custodies", "replacement_custody_item_id", {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "custody_items",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
