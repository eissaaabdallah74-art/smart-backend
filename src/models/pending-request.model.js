// src/models/pending-request.model.js
module.exports = (sequelize, DataTypes) => {
  const PendingRequest = sequelize.define(
    'PendingRequest',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'client_id',
      },

      hubId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'hub_id',
      },

      zoneId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'zone_id',
      },

      // تاريخ الطلب
      requestDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'request_date',
      },

      // شهر الفاتورة (مثال: "AUG 2024")
      billingMonth: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'billing_month',
      },

      // حالة الطلب
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
        field: 'status',
      },

      // ✅ Priority
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
        field: 'priority',
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'notes',
      },

      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'created_by',
      },

      updatedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'updated_by',
      },
    },
    {
      tableName: 'pending_requests',
      timestamps: true,
      underscored: true,
    }
  );

  return PendingRequest;
};
