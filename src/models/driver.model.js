// src/models/driver.model.js
module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define(
    'Driver',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // الاسم الإنجليزي
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      // الاسم بالعربي
      fullNameArabic: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'full_name_arabic',
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: {
          isEmail: {
            msg: 'Email is invalid',
          },
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

      // من جدول clients (هياخد الاسم من الواجهة)
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

      // من الـ operation users
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

      // من الـ HR users
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

      contractStatus: {
        type: DataTypes.STRING(50),
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
    },
    {
      tableName: 'drivers',
      timestamps: true,
      underscored: true,
    }
  );

  return Driver;
};
