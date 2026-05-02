const { FINANCE_TRANSACTION_TYPES } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
    const FinanceCategory = sequelize.define(
        'FinanceCategory',
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true,
            },
            type: {
                type: DataTypes.ENUM(...FINANCE_TRANSACTION_TYPES),
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'finance_categories',
            timestamps: true,
            underscored: true,
        }
    );

    return FinanceCategory;
};
