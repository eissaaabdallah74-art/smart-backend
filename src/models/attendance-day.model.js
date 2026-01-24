module.exports = (sequelize, DataTypes) => {
  const AttendanceDay = sequelize.define(
    'AttendanceDay',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      importId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'import_id' },
      employeeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'employee_id' },

      month: { type: DataTypes.STRING(7), allowNull: false }, // YYYY-MM
      date: { type: DataTypes.DATEONLY, allowNull: false },

      clockIn: { type: DataTypes.DATE, allowNull: true, field: 'clock_in' },
      clockOut: { type: DataTypes.DATE, allowNull: true, field: 'clock_out' },

      lateMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'late_minutes' },

      absent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // ✅ NEW: manual override to exclude this day from monthly totals/deduction
      isException: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_exception' },

      // Manual excuses allocated for this day (cached)
      excuseMinutesApplied: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'excuse_minutes_applied' },

      // Computed
      effectiveLateMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'effective_late_minutes' },
      graceApplied: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'grace_applied' },

      latePenaltyDays: { type: DataTypes.DECIMAL(4, 2), allowNull: false, defaultValue: 0, field: 'late_penalty_days' },
      absentPenaltyDays: { type: DataTypes.DECIMAL(4, 2), allowNull: false, defaultValue: 0, field: 'absent_penalty_days' },
      totalPenaltyDays: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0, field: 'total_penalty_days' },

      policyReason: { type: DataTypes.STRING(60), allowNull: true, field: 'policy_reason' },

      rawJson: { type: DataTypes.JSON, allowNull: true, field: 'raw_json' },
    },
    {
      tableName: 'attendance_days',
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ['import_id', 'employee_id', 'date'] },
        { fields: ['month'] },
      ],
    }
  );

  return AttendanceDay;
};
