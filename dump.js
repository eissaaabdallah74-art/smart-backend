require('dotenv').config();
const { Call, Auth } = require('./src/models');
const { Op } = require('sequelize');

async function run() {
  const users = await Auth.findAll({ where: { fullName: { [Op.like]: '%ahmed gabr%' } } });
  if (!users.length) {
     console.log('User not found');
     return;
  }
  const user = users[0];
  console.log(`Found user: ${user.id} ${user.fullName}`);
  
  const calls = await Call.findAll({ where: { assignee_id: user.id } });
  console.log(`User has ${calls.length} calls.`);
  for (const c of calls) {
     console.log(`[Call ${c.id}] Date: '${c.date}' | status: '${c.status}' | createdAt: ${c.createdAt}`);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
