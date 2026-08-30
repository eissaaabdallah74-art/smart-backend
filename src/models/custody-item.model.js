module.exports = (sequelize, DataTypes) => {
  const CustodyItem = sequelize.define(
    'CustodyItem',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      serialNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'serial_number',
      },
      status: {
        type: DataTypes.ENUM('available', 'assigned', 'damaged', 'lost'),
        allowNull: false,
        defaultValue: 'available',
      },
      totalQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'total_qty',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'custody_items',
      timestamps: true,
      underscored: true,
    }
  );

  return CustodyItem;
};
