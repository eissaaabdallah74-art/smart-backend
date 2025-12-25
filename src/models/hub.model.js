// src/models/hub.model.js
module.exports = (sequelize, DataTypes) => {
  const Hub = sequelize.define(
    'Hub',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'client_id',
      },
    },
    {
      tableName: 'hubs',
      timestamps: true,
      underscored: true,

      // حماية من التكرار: (client_id, name)
      indexes: [
        { unique: true, fields: ['client_id', 'name'] },
      ],

      hooks: {
        beforeValidate(hub) {
          if (typeof hub.name === 'string') {
            hub.name = hub.name.trim().replace(/\s+/g, ' ');
          }
        },
      },
    }
  );

  return Hub;
};
