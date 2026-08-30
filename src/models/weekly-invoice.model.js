module.exports = (sequelize, DataTypes) => {
    const WeeklyInvoice = sequelize.define('WeeklyInvoice', {
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
        weekIndex: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'week_index'
        },
        hubName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'hub_name'
        },
        entries: {
            type: DataTypes.JSON,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending_crm', 'disputed', 'submitted_to_finance', 'rejected_by_finance', 'approved_by_finance'),
            allowNull: false,
            defaultValue: 'pending_crm'
        },
        disputeReason: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'dispute_reason'
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'rejection_reason'
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'created_by'
        }
    }, {
        tableName: 'weekly_invoices',
        timestamps: true,
        underscored: true
    });

    return WeeklyInvoice;
};
