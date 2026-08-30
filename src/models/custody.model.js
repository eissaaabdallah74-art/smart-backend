module.exports = (sequelize, DataTypes) => {
  const Custody = sequelize.define(
    'Custody',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      custodyType: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'custody_type',
      },
      deliveryDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'delivery_date',
      },
      recipientType: {
        type: DataTypes.ENUM('employee', 'driver'),
        allowNull: false,
        field: 'recipient_type',
      },
      employeeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'employee_id',
      },
      driverId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'driver_id',
      },
      department: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('delivered', 'returned', 'replaced'),
        allowNull: false,
        defaultValue: 'delivered',
      },
      returnDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'return_date',
      },
      replacementDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'replacement_date',
      },
      replacementCustodyType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'replacement_custody_type',
      },
      custodyItemId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'custody_item_id',
      },
      replacementCustodyItemId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'replacement_custody_item_id',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'custodies',
      timestamps: true,
      underscored: true,
    }
  );

  return Custody;
};
