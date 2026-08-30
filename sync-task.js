const db = require('./src/models');
async function sync() {
  try {
    await db.UserTask.sync({ alter: true });
    console.log('UserTask synced.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
sync();
