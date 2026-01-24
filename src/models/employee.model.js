// src/models/employee.model.js
module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    'Employee',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Optional link to Auth user account
      authUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        unique: true,
        field: 'auth_user_id',
      },

      fullName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'full_name',
      },

      // Keep as STRING to preserve leading zeros and avoid integer issues
      nationalId: {
        type: DataTypes.STRING(14),
        allowNull: false,
        unique: true,
        field: 'national_id',
        validate: {
          len: [14, 14],
          isNumeric: true,
        },
      },

      birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'birth_date',
      },

      maritalStatus: {
        type: DataTypes.ENUM('single', 'married', 'divorced', 'widowed', 'engaged', 'unknown'),
        allowNull: true,
        defaultValue: 'unknown',
        field: 'marital_status',
      },

      religion: {
        type: DataTypes.ENUM('muslim', 'christian', 'other', 'unknown'),
        allowNull: true,
        defaultValue: 'unknown',
        field: 'religion',
      },

      nationality: {
        type: DataTypes.STRING(60),
        allowNull: true,
        field: 'nationality',
      },

      birthPlace: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'birth_place',
      },

      fullAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'full_address',
      },

      // Virtual computed age (do NOT store)
      age: {
        type: DataTypes.VIRTUAL,
        get() {
          const birthDate = this.getDataValue('birthDate');
          if (!birthDate) return null;
          const b = new Date(birthDate);
          const now = new Date();
          let age = now.getFullYear() - b.getFullYear();
          const m = now.getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
          return age;
        },
      },
    },
    {
      tableName: 'employees',
      timestamps: true,
      underscored: true,
    }
  );

  return Employee;
};
