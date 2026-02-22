module.exports = (sequelize, DataTypes) => {
  const DocumentType = sequelize.define(
    "DocumentType",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      nameAr: { type: DataTypes.STRING(160), allowNull: false },
      nameEn: { type: DataTypes.STRING(160), allowNull: true },
      defaultSoonDays: { type: DataTypes.INTEGER, allowNull: true }, // مثال: 90
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "document_types",
      underscored: true,
      timestamps: true,
    }
  );

  return DocumentType;
};
