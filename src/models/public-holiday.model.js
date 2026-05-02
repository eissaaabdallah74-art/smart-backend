// src/models/public-holiday.model.js
module.exports = (sequelize, DataTypes) => {
  const PublicHoliday = sequelize.define(
    "PublicHoliday",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
        comment: "The specific date of the holiday",
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Holiday name (e.g., Eid Al-Fitr)",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Additional notes or description",
      },
    },
    {
      tableName: "public_holidays",
      timestamps: true,
      underscored: true,
    }
  );

  return PublicHoliday;
};
