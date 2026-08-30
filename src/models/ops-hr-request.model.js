module.exports = (sequelize, DataTypes) => {
  const OpsHrRequest = sequelize.define(
    "OpsHrRequest",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      driverId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "driver_id",
      },

      requestedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "requested_by",
      },

      opsNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "ops_notes",
      },

      hrReply: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "hr_reply",
      },

      status: {
        type: DataTypes.ENUM("pending", "in_progress", "requires_action", "approved", "rejected", "enlisted"),
        allowNull: false,
        defaultValue: "pending",
        field: "status",
      },

      requiredAction: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: "required_action",
      },

      hrHandledBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "hr_handled_by",
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
      tableName: "ops_hr_requests",
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: "deleted_at",
    }
  );

  return OpsHrRequest;
};
