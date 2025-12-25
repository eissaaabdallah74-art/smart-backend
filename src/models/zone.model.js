// src/models/zone.model.js
module.exports = (sequelize, DataTypes) => {
  const Zone = sequelize.define(
    'Zone',
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
      hubId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'hub_id',
      },
    },
    {
      tableName: 'zones',
      timestamps: true,
      underscored: true,

      // حماية من التكرار: (hub_id, name)
      indexes: [
        { unique: true, fields: ['hub_id', 'name'] },
      ],

      hooks: {
        beforeValidate(zone) {
          if (typeof zone.name === 'string') {
            zone.name = zone.name.trim().replace(/\s+/g, ' ');
          }
        },
      },
    }
  );

  return Zone;
};
