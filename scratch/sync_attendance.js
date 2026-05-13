require('dotenv').config({ path: '../.env' });
const db = require("../src/models");

(async () => {
  try {
    await db.DriverAttendance.sync({ alter: true });
    console.log("DriverAttendance table synced successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Sync error:", err);
    process.exit(1);
  }
})();
