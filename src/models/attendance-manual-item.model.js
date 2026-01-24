module.exports = (sequelize, DataTypes) => {
  const AttendanceManualItem = sequelize.define(
    'AttendanceManualItem',
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

      month: {
        type: DataTypes.STRING(7),
        allowNull: false, // YYYY-MM
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      // deduct = خصم ، add = إضافة/تعويض
      direction: {
        type: DataTypes.ENUM('deduct', 'add'),
        allowNull: false,
        defaultValue: 'deduct',
      },

      // يا إما amount يا إما days
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      days: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
      },

      note: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      isException: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
  field: "is_exception",
},


      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'created_by',
      },
    },
    {
      tableName: 'attendance_manual_items',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['employee_id', 'month'] },
        { fields: ['month'] },
        { fields: ['date'] },
      ],
    }
  );

  return AttendanceManualItem;
};
