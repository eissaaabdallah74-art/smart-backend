const { sequelize } = require('./src/models');

async function fixSchema() {
  try {
    console.log('Fixing Task Schema...');
    const queryInterface = sequelize.getQueryInterface();
    const tasksTable = await queryInterface.describeTable('tasks');
    
    if (!tasksTable.attachment_link) {
      console.log('Adding attachment_link to tasks...');
      await queryInterface.addColumn('tasks', 'attachment_link', {
        type: require('sequelize').DataTypes.STRING(255),
        allowNull: true
      });
    }

    if (!tasksTable.delivery_note) {
      console.log('Adding delivery_note to tasks...');
      await queryInterface.addColumn('tasks', 'delivery_note', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!tasksTable.rate) {
      console.log('Adding rate to tasks...');
      await queryInterface.addColumn('tasks', 'rate', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: true
      });
    }

    // Also check for profile_image in auth_users
    const usersTable = await queryInterface.describeTable('auth_users');
    if (!usersTable.profile_image) {
      console.log('Adding profile_image to auth_users...');
      await queryInterface.addColumn('auth_users', 'profile_image', {
        type: require('sequelize').DataTypes.STRING(255),
        allowNull: true
      });
    }

    console.log('Schema fix completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing schema:', err);
    process.exit(1);
  }
}

fixSchema();
