module.exports = (sequelize, DataTypes) => {
  const WhatsappTemplateGroup = sequelize.define(
    "WhatsappTemplateGroup",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "whatsapp_template_groups",
      timestamps: true,
    }
  );

  WhatsappTemplateGroup.associate = (models) => {
    WhatsappTemplateGroup.hasMany(models.WhatsappTemplate, {
      foreignKey: "groupId",
      as: "templates",
      onDelete: "CASCADE",
    });
  };

  return WhatsappTemplateGroup;
};
