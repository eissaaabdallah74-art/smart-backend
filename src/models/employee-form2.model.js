// src/models/employee-form2.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeForm2 = sequelize.define(
    'EmployeeForm2',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'employee_id',
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'employee_form2',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['employee_id', 'year'],
        },
      ],
    }
  );

  return EmployeeForm2;
};
