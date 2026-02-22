module.exports = (sequelize, DataTypes) => {
  const CompanyDocument = sequelize.define(
    "CompanyDocument",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      companyId: { type: DataTypes.INTEGER, allowNull: false, field: "company_id" },
      typeId: { type: DataTypes.INTEGER, allowNull: false, field: "type_id" },

      documentNumber: { type: DataTypes.STRING(120), allowNull: true, field: "document_number" },

      issueDate: { type: DataTypes.DATEONLY, allowNull: true, field: "issue_date" },
      expiryDate: { type: DataTypes.DATEONLY, allowNull: true, field: "expiry_date" },

      // لو “25 سنة من تاريخ الاصدار”
      validityYears: { type: DataTypes.INTEGER, allowNull: true, field: "validity_years" },

      currentLocation: { type: DataTypes.STRING(200), allowNull: true, field: "current_location" },

      custodianRole: { type: DataTypes.STRING(40), allowNull: true, field: "custodian_role" }, // LAWYER / EMPLOYEE / OTHER
      custodianName: { type: DataTypes.STRING(160), allowNull: true, field: "custodian_name" },
      custodianPhone: { type: DataTypes.STRING(60), allowNull: true, field: "custodian_phone" },
      custodianOrganization: { type: DataTypes.STRING(160), allowNull: true, field: "custodian_organization" },

      remindAt: { type: DataTypes.DATEONLY, allowNull: true, field: "remind_at" },
      remindNote: { type: DataTypes.STRING(255), allowNull: true, field: "remind_note" },

      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "company_documents",
      underscored: true,
      timestamps: true,
      indexes: [
        { fields: ["company_id"] },
        { fields: ["type_id"] },
        { fields: ["expiry_date"] },
      ],
    }
  );

  return CompanyDocument;
};
