// src/models/auth.model.js
module.exports = (sequelize, DataTypes) => {
  const Auth = sequelize.define(
    'Auth',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(
          'admin',
          'crm',
          'operation',
          'hr',
          'finance',
          'supply_chain'
        ),
        defaultValue: 'operation',
      },
      position: {
        type: DataTypes.ENUM('manager', 'supervisor', 'senior', 'junior'),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      // الحقول الجديدة
      hireDate: {
        type: DataTypes.DATEONLY, // تاريخ التعيين
        allowNull: true,
      },
      terminationDate: {
        type: DataTypes.DATEONLY, // تاريخ الاستقالة/الفصل
        allowNull: true,
      },
      creationDate: {
        type: DataTypes.DATEONLY, // تاريخ الإنشاء في النظام
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'auth_users',
      timestamps: true,
      underscored: true,
    }
  );

  return Auth;
};