// src/models/interview.model.js
const { VEHICLE_TYPES } = require('../constants/vehicle-types');

module.exports = (sequelize, DataTypes) => {
  const Interview = sequelize.define(
    'Interview',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      ticketNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'ticket_no',
      },

      // تاريخ انتهاء التذكرة (14 يوم بعد HR Signed)
      ticketExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'ticket_expires_at',
      },

      ticketNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'ticket_no',
      },

      courierName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'courier_name',
      },

      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: 'phone_number',
      },

      nationalId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'national_id',
      },

      residence: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'residence',
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

      position: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      vehicleType: {
        type: DataTypes.ENUM(...VEHICLE_TYPES),
        allowNull: true,
        field: 'vehicle_type',
      },


        // ===== NEW: Idempotency tracking =====
      inventoryAppliedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'inventory_applied_at',
      },
      inventoryPendingRequestId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'inventory_pending_request_id',
      },
      inventoryPendingRequestItemId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'inventory_pending_request_item_id',
      },

      accountManagerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'account_manager_id',
      },

      interviewerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'interviewer_id',
      },

      // قرار الـ interviewer / HR contract status
      signedWithHr: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'signed_with_hr',
      },

      feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // HR feedback (اللي انت بتسميه Security query decision)
      hrFeedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'hr_feedback',
      },

      crmFeedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'crm_feedback',
      },

      followUp1: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'follow_up_1',
      },

      followUp2: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'follow_up_2',
      },

      followUp3: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'follow_up_3',
      },

      courierStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'courier_status',
      },

      // نتيجة الاستعلام الأمني (Positive / Negative)
      securityResult: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'security_result',
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'interviews',
      timestamps: true,
      underscored: true,
    }
  );

  return Interview;
};
