// src/models/attendance-request.model.js
module.exports = (sequelize, DataTypes) => {
  const AttendanceRequest = sequelize.define(
    "AttendanceRequest",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      employeeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "employee_id" },

      month: { type: DataTypes.STRING(7), allowNull: false }, // YYYY-MM (derived from date)
      date: { type: DataTypes.DATEONLY, allowNull: false },

      type: {
        // keep as-is to avoid big schema refactor
        // - excuse_minutes
        // - leave_day (annual/sick/errand)
        type: DataTypes.ENUM("excuse_minutes", "leave_day"),
        allowNull: false,
      },

      // for excuse_minutes only
      minutes: { type: DataTypes.INTEGER, allowNull: true },

      // for leave_day only
      leaveType: {
        // ✅ added "errand"
        type: DataTypes.ENUM("annual", "sick", "unpaid", "errand", "other"),
        allowNull: true,
        field: "leave_type",
      },

      note: { type: DataTypes.STRING(255), allowNull: true },

      status: {
        // ✅ added "cancelled"
        type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },

      createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "created_by" },
      decidedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "decided_by" },
      decidedAt: { type: DataTypes.DATE, allowNull: true, field: "decided_at" },
      decisionNote: { type: DataTypes.STRING(255), allowNull: true, field: "decision_note" },
    },
    {
      tableName: "attendance_requests",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["month"] },
        { fields: ["status", "month"] },
        { fields: ["employee_id", "month"] },
        // prevent duplicates per day/type
        { unique: true, fields: ["employee_id", "date", "type"] },
      ],
    }
  );

  return AttendanceRequest;
};
