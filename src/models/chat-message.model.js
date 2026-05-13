// src/models/chat-message.model.js
module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define("ChatMessage", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sender_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    receiver_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true, // Null for group chats
    },
    room_type: {
      type: DataTypes.ENUM("private", "department", "managers"),
      allowNull: false,
    },
    room_name: {
      type: DataTypes.STRING,
      allowNull: false, // e.g., 'dept_crm', 'managers_global', 'private_1_2'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: "chat_messages",
    timestamps: true,
    underscored: true,
  });

  return ChatMessage;
};
