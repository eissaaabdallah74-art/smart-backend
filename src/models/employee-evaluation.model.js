// src/models/employee-evaluation.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeEvaluation = sequelize.define(
    'EmployeeEvaluation',
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

      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'year',
      },

      performanceRating: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'performance_rating',
      },

      commitmentGrade: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'commitment_grade',
      },
    },
    {
      tableName: 'employee_evaluations',
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ['employee_id', 'year'], unique: true }],
    }
  );

  return EmployeeEvaluation;
};
