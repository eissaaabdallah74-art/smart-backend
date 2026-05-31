module.exports = (sequelize, DataTypes) => {
    const AIUsageLog = sequelize.define('AIUsageLog', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },
        authUserId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            field: 'auth_user_id'
        },
        employeeId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: 'employee_id'
        },
        provider: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        requestedProvider: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'requested_provider'
        },
        actualProvider: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'actual_provider'
        },
        model: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        toolName: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'tool_name'
        },
        promptPreview: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'prompt_preview'
        },
        responsePreview: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'response_preview'
        },
        status: {
            type: DataTypes.ENUM('SUCCESS', 'FAILED'),
            defaultValue: 'SUCCESS'
        },
        fallbackUsed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'fallback_used'
        },
        fallbackReason: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field: 'fallback_reason'
        },
        retryCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'retry_count'
        },
        latencyMs: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'latency_ms'
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'error_message'
        }
    }, {
        tableName: 'ai_usage_logs',
        timestamps: true,
        underscored: true
    });

    AIUsageLog.associate = (models) => {
        AIUsageLog.belongsTo(models.Auth, { foreignKey: 'authUserId', as: 'user' });
        AIUsageLog.belongsTo(models.Employee, { foreignKey: 'employeeId', as: 'employee' });
    };

    return AIUsageLog;
};
