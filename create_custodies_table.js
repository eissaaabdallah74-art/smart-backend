const { sequelize } = require("./src/models");
const { DataTypes } = require("sequelize");

async function migrate() {
  try {
    console.log("Checking and creating custodies table...");
    const queryInterface = sequelize.getQueryInterface();

    // Create Table custodies if not exists
    await queryInterface.createTable("custodies", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      custody_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      delivery_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      recipient_type: {
        type: DataTypes.ENUM("employee", "driver"),
        allowNull: false,
      },
      employee_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "employees",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      driver_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "drivers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      department: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("delivered", "returned", "replaced"),
        allowNull: false,
        defaultValue: "delivered",
      },
      return_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      replacement_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
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

    console.log("Custodies table created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
