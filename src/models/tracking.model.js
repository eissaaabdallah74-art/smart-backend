// src/models/tracking.model.js
module.exports = (sequelize, DataTypes) => {
  const Tracking = sequelize.define(
    'Tracking',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // FK على جدول drivers
      driverId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'driver_id',
      },

      // DSP Shortcode (7165..)
      dspShortcode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'dsp_shortcode',
      },

      // DAs First / Last / Username
      dasFirstName: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'das_first_name',
      },
      dasLastName: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'das_last_name',
      },
      dasUsername: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'das_username',
      },

      // Visa Sponsorship on DSP ? (Yes / No)
      visaSponsorshipOnDsp: {
        type: DataTypes.ENUM('yes', 'no'),
        allowNull: true,
        field: 'visa_sponsorship_on_dsp',
      },

      birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'birth_date',
      },

      vehiclePlateNumber: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'vehicle_plate_number',
      },

      criminalRecordIssueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'criminal_record_issue_date',
      },

      // EGY National ID-Expiry Date
      idExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'id_expiry_date',
      },

      // Driving License (DL)-Expiry Date
      dLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'd_license_expiry_date',
      },

      // Vehicle License-Expiry Date
      vLicenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'v_license_expiry_date',
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'driver_tracking',
      timestamps: true,
      underscored: true,
    }
  );

  return Tracking;
};
