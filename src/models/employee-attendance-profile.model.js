module.exports = (sequelize, DataTypes) => {
  const EmployeeAttendanceProfile = sequelize.define(
    'EmployeeAttendanceProfile',
    {
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        field: 'employee_id',
      },
      attendanceEmpNo: {
        type: DataTypes.STRING(30),
        allowNull: true,
        unique: true,
        field: 'attendance_emp_no',
      },
      attendanceAcNo: {
        type: DataTypes.STRING(30),
        allowNull: true,
        unique: true,
        field: 'attendance_ac_no',
      },
      notes: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'notes',
      },
    },
    {
      tableName: 'employee_attendance_profiles',
      timestamps: true,
      underscored: true,
    }
  );

  return EmployeeAttendanceProfile;
};
