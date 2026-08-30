module.exports = (sequelize, DataTypes) => {
  const CourierClearance = sequelize.define(
    'CourierClearance',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      driverId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        field: 'driver_id',
      },
      operationStatus: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
        field: 'operation_status',
      },
      operationApprovedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'operation_approved_by',
      },
      operationNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'operation_notes',
      },
      operationApprovedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'operation_approved_at',
      },
      financeStatus: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
        field: 'finance_status',
      },
      financeApprovedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'finance_approved_by',
      },
      financeNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'finance_notes',
      },
      financeApprovedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'finance_approved_at',
      },
      hrStatus: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
        field: 'hr_status',
      },
      hrApprovedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'hr_approved_by',
      },
      hrNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'hr_notes',
      },
      hrApprovedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'hr_approved_at',
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      tableName: 'courier_clearances',
      timestamps: true,
      underscored: true,
    }
  );

  return CourierClearance;
};
