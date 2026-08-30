const db = require('./src/models');

async function sync() {
  console.log('Syncing models with alter: true...');
  await db.Interview.sync({ alter: true });
  await db.Driver.sync({ alter: true });
  console.log('Sync complete.');
  process.exit(0);
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
