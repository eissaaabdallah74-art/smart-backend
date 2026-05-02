module.exports = (sequelize, DataTypes) => {
    const DriverNotificationBlast = sequelize.define(
        'DriverNotificationBlast',
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            senderId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                field: 'sender_id',
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
            filters: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'Stores the criteria used to select recipients (e.g. {hub: "X", clientName: "Y"})'
            },
            recipientsCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'recipients_count'
            }
        },
        {
            tableName: 'driver_notification_blasts',
            timestamps: true,
            underscored: true,
        }
    );

    return DriverNotificationBlast;
};
