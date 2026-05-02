module.exports = (sequelize, DataTypes) => {
    const DriverNotification = sequelize.define(
        'DriverNotification',
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            driverId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                field: 'driver_id',
            },
            blastId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
                field: 'blast_id',
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            type: {
                type: DataTypes.ENUM('normal', 'popup'),
                defaultValue: 'normal',
                allowNull: false,
            },
            isRead: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: 'is_read',
            }
        },
        {
            tableName: 'driver_notifications',
            timestamps: true,
            underscored: true,
        }
    );

    return DriverNotification;
};
