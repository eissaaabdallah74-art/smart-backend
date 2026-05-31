'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop existing table if any to ensure clean production hardening
    await queryInterface.dropTable('ai_usage_logs', { cascade: true }).catch(() => {});
    
    await queryInterface.createTable('ai_usage_logs', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      auth_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      employee_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      requested_provider: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      actual_provider: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      model: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      tool_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      prompt_preview: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      response_preview: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('SUCCESS', 'FAILED'),
        defaultValue: 'SUCCESS'
      },
      fallback_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      fallback_reason: {
        type: Sequelize.STRING(150),
        allowNull: true
      },
      retry_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_usage_logs');
  }
};
