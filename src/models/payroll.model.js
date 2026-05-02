const { PAYROLL_STATUSES } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
    const Payroll = sequelize.define(
        'Payroll',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
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
            month: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            year: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            basicSalary: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                field: 'basic_salary',
            },
            allowances: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            deductions: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            netSalary: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                field: 'net_salary',
            },
            status: {
                type: DataTypes.ENUM(...PAYROLL_STATUSES),
                allowNull: false,
                defaultValue: 'pending',
            },
            paymentDate: {
                type: DataTypes.DATEONLY,
                allowNull: true,
                field: 'payment_date',
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'payrolls',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['employee_id', 'month', 'year'],
                    where: {
                        employee_id: { [sequelize.Sequelize.Op.ne]: null }
                    }
                },
                {
                    unique: true,
                    fields: ['driver_id', 'month', 'year'],
                    where: {
                        driver_id: { [sequelize.Sequelize.Op.ne]: null }
                    }
                }
            ]
        }
    );

    return Payroll;
};
