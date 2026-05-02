module.exports = (sequelize, DataTypes) => {
    const FinanceTransaction = sequelize.define(
        'FinanceTransaction',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            categoryId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                field: 'category_id',
            },
            amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
            },
            transactionDate: {
                type: DataTypes.DATEONLY,
                allowNull: false,
                field: 'transaction_date',
                defaultValue: DataTypes.NOW,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            referenceId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
                field: 'reference_id',
                comment: 'Id of the related entity (e.g. Payroll Id)',
            },
            referenceType: {
                type: DataTypes.STRING(50),
                allowNull: true,
                field: 'reference_type',
                comment: 'Type of the related entity (e.g. "Payroll")',
            },
            createdById: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
                field: 'created_by_id',
            },
        },
        {
            tableName: 'finance_transactions',
            timestamps: true,
            underscored: true,
        }
    );

    return FinanceTransaction;
};
