// src/models/client.model.js
module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define(
    'Client',
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
      crm: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'phone_number',
      },
      pointOfContact: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'point_of_contact',
      },
      contactEmail: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'contact_email',
        validate: {
          isEmail: {
            msg: 'Contact email is invalid',
          },
        },
      },
      accountManager: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'account_manager',
      },
      // الحقول الجديدة
      contractDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'contract_date',
      },
      contractTerminationDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'contract_termination_date',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      company: {
        type: DataTypes.ENUM('1', '2'),
        allowNull: true,
      },
      clientType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'client_type',
      },
    },
    {
      tableName: 'clients',
      timestamps: true,
      underscored: true,
    }
  );

  return Client;
};