// src/models/landing-page-setting.model.js
module.exports = (sequelize, DataTypes) => {
  const LandingPageSetting = sequelize.define(
    'LandingPageSetting',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      badgeText: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      titleHTML: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      stats: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      backgroundImageUrl: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
    },
    {
      tableName: 'landing_page_settings',
      timestamps: true,
    }
  );

  return LandingPageSetting;
};
