const db = require("./src/models");

async function run() {
  try {
    await db.sequelize.authenticate();
    console.log("Database connected. Syncing OldTrustReceipt table...");
    await db.OldTrustReceipt.sync({ alter: true });
    console.log("Table 'old_trust_receipts' synced successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
