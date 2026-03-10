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

      // NEW: Manager info
      managerHubName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'manager_hub_name',
      },

      managerHubPhone: {
        type: DataTypes.STRING(30),
        allowNull: true,
        field: 'manager_hub_phone',
      },

      managerHubEmail: {
        type: DataTypes.STRING(190),
        allowNull: true,
        field: 'manager_hub_email',
        validate: {
          isEmail: true, // Sequelize built-in
        },
      },
    },
    {
      tableName: 'hubs',
      timestamps: true,
      underscored: true,

      // حماية من التكرار: (client_id, name)
      indexes: [{ unique: true, fields: ['client_id', 'name'] }],

      hooks: {
        beforeValidate(hub) {
          // Normalize hub name
          if (typeof hub.name === 'string') {
            hub.name = hub.name.trim().replace(/\s+/g, ' ');
          }

          // Normalize manager name
          if (typeof hub.managerHubName === 'string') {
            const v = hub.managerHubName.trim().replace(/\s+/g, ' ');
            hub.managerHubName = v || null;
          }

          // Normalize manager phone (simple cleanup)
          if (typeof hub.managerHubPhone === 'string') {
            const v = hub.managerHubPhone.trim().replace(/\s+/g, '').replace(/-/g, '');
            hub.managerHubPhone = v || null;
          }

          // Normalize manager email
          if (typeof hub.managerHubEmail === 'string') {
            const v = hub.managerHubEmail.trim().toLowerCase();
            hub.managerHubEmail = v || null;
          }
        },
      },
    }
  );

  return Hub;
};