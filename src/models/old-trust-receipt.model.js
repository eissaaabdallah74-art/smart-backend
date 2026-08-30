module.exports = (sequelize, DataTypes) => {
  const OldTrustReceipt = sequelize.define(
    "OldTrustReceipt",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      courierName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: "courier_name",
      },

      residence: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "residence",
      },

      nationalId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "national_id",
      },

      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "phone_number",
      },

      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: "amount",
      },

      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Signed",
        field: "status",
      },

      // Audit Fields
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
      tableName: "old_trust_receipts",
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: "deleted_at",
    }
  );

  return OldTrustReceipt;
};
