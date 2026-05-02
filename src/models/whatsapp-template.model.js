module.exports = (sequelize, DataTypes) => {
  const WhatsappTemplate = sequelize.define(
    "WhatsappTemplate",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      groupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "whatsapp_template_groups",
          key: "id",
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "whatsapp_templates",
      timestamps: true,
    }
  );

  WhatsappTemplate.associate = (models) => {
    WhatsappTemplate.belongsTo(models.WhatsappTemplateGroup, {
      foreignKey: "groupId",
      as: "group",
    });
  };

  return WhatsappTemplate;
};
