module.exports = (sequelize, DataTypes) => {
  const AttendanceImport = sequelize.define(
    'AttendanceImport',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      month: { type: DataTypes.STRING(7), allowNull: false }, // YYYY-MM
      status: {
        type: DataTypes.ENUM('processing', 'done', 'failed'),
        allowNull: false,
        defaultValue: 'processing',
      },

      originalFilename: { type: DataTypes.STRING(255), allowNull: true, field: 'original_filename' },

      uploadedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'uploaded_by' },

      // distinct dates count from sheet (working days count)
      workingDaysCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'working_days_count' },

      // stats
      rowsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'rows_count' },
      matchedRowsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'matched_rows_count' },
      unmatchedRowsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'unmatched_rows_count' },

      // store unmatched samples (for UI mapping) - keep small
      unmatchedSampleJson: { type: DataTypes.JSON, allowNull: true, field: 'unmatched_sample_json' },
    },
    {
      tableName: 'attendance_imports',
      timestamps: true,
      underscored: true,
    }
  );

  return AttendanceImport;
};
