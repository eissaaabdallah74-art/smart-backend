// src/models/employee-document.model.js
module.exports = (sequelize, DataTypes) => {
  const EmployeeDocument = sequelize.define(
    'EmployeeDocument',
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

      docType: {
        type: DataTypes.ENUM(
          'work_stub',
          'insurance_print',
          'id_copy',
          'criminal_record',
          'utilities_receipt',
          'personal_photos',
          'qualification',
          'birth_certificate',
          'military_status',
          'employment_contract',
          'other'
        ),
        allowNull: false,
        field: 'doc_type',
      },

      status: {
        type: DataTypes.ENUM('missing', 'provided', 'copy', 'not_applicable'),
        allowNull: false,
        defaultValue: 'missing',
        field: 'status',
      },

      fileUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'file_url',
      },

      notes: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'notes',
      },
    },
    {
      tableName: 'employee_documents',
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ['employee_id', 'doc_type'], unique: true }],
    }
  );

  return EmployeeDocument;
};
