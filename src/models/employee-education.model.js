// src/models/employee-education.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeEducation = sequelize.define(
    'EmployeeEducation',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'employee_id',
      },

      degree: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: 'degree',
      },

      major: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'major',
      },

      institute: {
        type: DataTypes.STRING(160),
        allowNull: true,
        field: 'institute',
      },

      graduationYear: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'graduation_year',
      },

      grade: {
        type: DataTypes.STRING(60),
        allowNull: true,
        field: 'grade',
      },
    },
    {
      tableName: 'employee_educations',
      timestamps: true,
      underscored: true,
    }
  );

  return EmployeeEducation;
};
