module.exports = (sequelize, DataTypes) => {
    const DriverComplaint = sequelize.define('DriverComplaint', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        driverId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            field: 'driver_id'
        },
        subject: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        text: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'reviewed', 'solved', 'rejected'),
            defaultValue: 'pending',
            allowNull: false
        },
        adminReply: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'admin_reply'
        }
    }, {
        tableName: 'driver_complaints',
        timestamps: true,
        underscored: true
    });

    return DriverComplaint;
};
