// src/models/call.model.js
module.exports = (sequelize, DataTypes) => {
  const Call = sequelize.define(
    'Call',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // ممكن تسيبه لو عايز تربط بـ Client بعدين
      client_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      // الشخص اللي الـ call متأسّنة عليه (Senior / Junior)
      assignee_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // مين اللي أنشأ الـ call (Manager / Supervisor / Admin)
      created_by_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // ===== الحقول اللي جايه من الشيت =====

      // date من الشيت (ممكن تاريخ فقط)
      date: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Name
      name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },

      // Phone
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      // vehicle
      vehicle_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // Government
      government: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // Call Feedback
      call_feedback: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },

      // What's app message
      whatsapp_status: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },

      // comment
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // smart or smv (ENUM)
      smart_or_smv: {
        type: DataTypes.ENUM('smart', 'smv'),
        allowNull: true,
      },

      // Second call Comment
      second_call_comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Status عام للـ workflow
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'rescheduled'),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      tableName: 'calls',
      timestamps: true,
      underscored: true,
    }
  );

  return Call;
};
