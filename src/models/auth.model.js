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
          'supply_chain',
          'poc'
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
      managerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'manager_id',
      },
      interviewTarget: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'interview_target',
      },
      kpiAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'kpi_amount',
        comment: 'Total monthly KPI amount for the user',
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
        field: 'creation_date',
      },
      permissions: {
        type: DataTypes.JSON, // الصلاحيات التفصيلية
        allowNull: true,
      },
      accessExpiresAt: {
        type: DataTypes.DATE, // تاريخ انتهاء الوصول
        allowNull: true,
        field: 'access_expires_at',
      },
      profileImage: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'profile_image',
      },
      weekendPolicy: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'weekend_policy',
        comment: 'Custom weekend policy for this user (e.g., how many Saturdays off)',
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