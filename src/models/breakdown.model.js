module.exports = (sequelize, DataTypes) => {
    const Breakdown = sequelize.define('Breakdown', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        clientId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'client_id'
        },
        month: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        year: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        entries: {
            type: DataTypes.JSON,
            allowNull: false
        },
        isLocked: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'is_locked'
        }
    }, {
        tableName: 'breakdowns',
        timestamps: true,
        underscored: true,
        uniqueKeys: {
            unique_breakdown: {
                fields: ['client_id', 'month', 'year']
            }
        }
    });

    return Breakdown;
};
