// src/models/driver.model.js
const {
  DRIVER_CONTRACT_STATUSES,
  SIGNED_WITH_HR_STATUSES,
} = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define(
    'Driver',
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

      fullNameArabic: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'full_name_arabic',
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: {
          isEmail: { msg: 'Email is invalid' },
        },
      },

      courierPhone: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'courier_phone',
      },

      courierId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'courier_id',
      },

      residence: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      courierCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'courier_code',
      },

      clientName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'client_name',
      },

      hub: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      area: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      module: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      vehicleType: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'vehicle_type',
      },

      contractor: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      pointOfContact: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'point_of_contact',
      },

      accountManager: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'account_manager',
      },

      interviewer: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      hrRepresentative: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'hr_representative',
      },

      hiringDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'hiring_date',
      },

      day1Date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'day1_date',
      },

      vLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'v_license_expiry_date',
      },

      dLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'd_license_expiry_date',
      },

      idExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'id_expiry_date',
      },

      liabilityAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'liability_amount',
      },

      signed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      /**
       * ✅ NEW: HR outcome as enum (moved from old Driver.contractStatus behavior)
       */
      signedWithHr: {
        type: DataTypes.ENUM(...SIGNED_WITH_HR_STATUSES),
        allowNull: true,
        field: 'signed_with_hr',
      },

      /**
       * ✅ NOW: Contract status means driver's operational status (as you requested)
       */
      contractStatus: {
        type: DataTypes.ENUM(...DRIVER_CONTRACT_STATUSES),
        allowNull: true,
        field: 'contract_status',
      },

      hiringStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'hiring_status',
      },

      securityQueryStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'security_query_status',
      },

      securityQueryComment: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'security_query_comment',
      },

      exceptionBy: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'exception_by',
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // ===================== Audit Fields =====================
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'created_by_id',
      },
      updatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'updated_by_id',
      },
      deletedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'deleted_by_id',
      },
    },
    {
      tableName: 'drivers',
      timestamps: true,
      underscored: true,

      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  // optional helpers
  Driver.CONTRACT_STATUSES = DRIVER_CONTRACT_STATUSES;
  Driver.SIGNED_WITH_HR_STATUSES = SIGNED_WITH_HR_STATUSES;

  return Driver;
};
