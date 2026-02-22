// src/models/audit-log.model.js
module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    "AuditLog",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

      entity: { type: DataTypes.STRING(64), allowNull: false },
      entityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

      action: { type: DataTypes.STRING(32), allowNull: false },
      summary: { type: DataTypes.STRING(255), allowNull: true },

      changes: { type: DataTypes.JSON, allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },

      requestId: { type: DataTypes.STRING(64), allowNull: true },
      actorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // ✅ matches auth_users.id

      ip: { type: DataTypes.STRING(64), allowNull: true },
      userAgent: { type: DataTypes.STRING(255), allowNull: true },
      method: { type: DataTypes.STRING(12), allowNull: true },
      path: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      tableName: "audit_logs",
      underscored: true,
      timestamps: true,
      indexes: [
        { fields: ["entity", "entity_id", "created_at"] },
        { fields: ["actor_id", "created_at"] },
        { fields: ["request_id"] },
      ],
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.Auth, { as: "actor", foreignKey: "actorId" });
  };

  return AuditLog;
};
