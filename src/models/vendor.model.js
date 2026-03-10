// src/models/vendor.model.js
module.exports = (sequelize, DataTypes) => {
  const Vendor = sequelize.define(
    "Vendor",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },

      mobile: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: { isEmail: { msg: "Email is invalid" } },
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_active",
      },

      // optional audit fields if you want consistency
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "created_by_id",
      },
      updatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "updated_by_id",
      },
      deletedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "deleted_by_id",
      },
    },
    {
      tableName: "vendors",
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: "deleted_at",
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["mobile"] },
        { fields: ["is_active"] },
      ],
    }
  );

  return Vendor;
};