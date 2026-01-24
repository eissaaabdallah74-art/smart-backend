module.exports = (sequelize, DataTypes) => {
  const AttendanceExcuse = sequelize.define(
    'AttendanceExcuse',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      employeeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'employee_id' },
      date: { type: DataTypes.DATEONLY, allowNull: false },

      minutes: { type: DataTypes.INTEGER, allowNull: false }, // <= 120
      note: { type: DataTypes.STRING(255), allowNull: true },

      createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'created_by' },
    },
    {
      tableName: 'attendance_excuses',
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ['employee_id', 'date'] }],
    }
  );

  return AttendanceExcuse;
};
