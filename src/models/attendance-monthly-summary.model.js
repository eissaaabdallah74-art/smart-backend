module.exports = (sequelize, DataTypes) => {
  const AttendanceMonthlySummary = sequelize.define(
    'AttendanceMonthlySummary',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      importId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'import_id' },
      employeeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'employee_id' },
      month: { type: DataTypes.STRING(7), allowNull: false },

      graceUsedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'grace_used_count' },

      totalLateMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_late_minutes' },
      totalEffectiveLateMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_effective_late_minutes' },

      totalExcuseMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_excuse_minutes' },
      excusesCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'excuses_count' },

      absentDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'absent_days' },

      totalLatePenaltyDays: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0, field: 'total_late_penalty_days' },
      totalAbsentPenaltyDays: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0, field: 'total_absent_penalty_days' },
      totalPenaltyDays: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0, field: 'total_penalty_days' },

      // Payroll calculation (optional if salary missing)
      salaryGrossUsed: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'salary_gross_used' },
      dayRate: { type: DataTypes.DECIMAL(12, 6), allowNull: true, field: 'day_rate' },
      deductionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'deduction_amount' },

      computedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'computed_at' },
    },
    {
      tableName: 'attendance_monthly_summaries',
      timestamps: true,
      underscored: true,
      indexes: [{ unique: true, fields: ['import_id', 'employee_id'] }, { fields: ['month'] }],
    }
  );

  return AttendanceMonthlySummary;
};
