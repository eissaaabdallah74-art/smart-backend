const attendanceSyncService = require('../src/services/attendance-sync.service');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  console.error(err.stack);
});

async function test() {
  try {
    console.log("--- STARTING TEST ---");
    await attendanceSyncService.syncDeviceLogs(1);
    console.log("--- TEST FINISHED SUCCESSFULLY ---");
  } catch (error) {
    console.log("--- TEST FAILED ---");
    console.log(error);
    console.log(error.stack);
  } finally {
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

test();
