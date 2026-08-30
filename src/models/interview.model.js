// src/models/interview.model.js
const { VEHICLE_TYPES } = require("../constants/vehicle-types");
const { SIGNED_WITH_HR_STATUSES, DRIVER_PAYMENT_METHODS } = require("../constants/enums");

module.exports = (sequelize, DataTypes) => {
  const Interview = sequelize.define(
    "Interview",
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
        field: "ticket_no",
      },

      ticketExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "ticket_expires_at",
      },

      courierName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: "courier_name",
      },

      courierId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "courier_id",
      },

      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "phone_number",
      },

      nationalId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "national_id",
      },

      residence: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: "residence",
      },

      relativeName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: "relative_name",
      },

      relativePhoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "relative_phone_number",
      },

      contractLocationType: {
        type: DataTypes.ENUM("company", "courier"),
        allowNull: true,
        defaultValue: "company",
        field: "contract_location_type",
      },

      contractLocationCourierId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "contract_location_courier_id",
      },

      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "client_id",
      },

      hubId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "hub_id",
      },

      zoneId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "zone_id",
      },

      position: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      vehicleType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "vehicle_type",
      },

      vehiclePlateNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "vehicle_plate_number",
      },

      module: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // ===================== NEW: Expiry Dates (to sync into Driver) =====================
      vLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "v_license_expiry_date",
      },
      dLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "d_license_expiry_date",
      },
      idExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "id_expiry_date",
      },

      // ===== Idempotency tracking =====
      inventoryAppliedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "inventory_applied_at",
      },
      inventoryPendingRequestId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "inventory_pending_request_id",
      },
      inventoryPendingRequestItemId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "inventory_pending_request_item_id",
      },

      accountManagerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "account_manager_id",
      },

      interviewerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "interviewer_id",
      },

      signedWithHr: {
        type: DataTypes.ENUM(...SIGNED_WITH_HR_STATUSES),
        allowNull: true,
        field: "signed_with_hr",
      },

      feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      hrFeedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "hr_feedback",
      },

      crmFeedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "crm_feedback",
      },

      followUp1: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "follow_up_1",
      },

      followUp2: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "follow_up_2",
      },

      followUp3: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "follow_up_3",
      },

      courierStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "courier_status",
      },

      securityResult: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: "security_result",
      },

      day1Date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "day1_date",
      },

      hiringDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "hiring_date",
      },

      vendorId: {
  type: DataTypes.INTEGER.UNSIGNED,
  allowNull: false, // ✅ interview لازم يحدد vendor
  field: "vendor_id",
},

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      trustReceiptsCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: "trust_receipts_count",
      },

      trustReceiptsAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        field: "trust_receipts_amount",
      },

      // ===================== NEW Financial Fields =====================
      paymentMethod: {
        type: DataTypes.ENUM(...DRIVER_PAYMENT_METHODS),
        allowNull: true,
        field: "payment_method",
      },
      bankName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: "bank_name",
      },
      bankAccountNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "bank_account_number",
      },
      walletName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: "wallet_name",
      },
      walletNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "wallet_number",
      },

      // ===================== CRM Day 1 Exceptions =====================
      crmDay1Status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "crm_day1_status",
      },
      crmDay1ApprovedAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "crm_day1_approved_at",
      },

      // ===================== Audit Fields =====================
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
      tableName: "interviews",
      timestamps: true,
      underscored: true,

      // Soft delete
      paranoid: true,
      deletedAt: "deleted_at",
    },
  );

  return Interview;
};
