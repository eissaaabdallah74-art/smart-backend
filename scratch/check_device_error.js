const { AttendanceDevice } = require('../src/models');

async function check() {
  try {
    const device = await AttendanceDevice.findByPk(1);
    if (!device) {
      console.log('Device not found');
    } else {
      console.log('Device IP:', device.ipAddress);
      console.log('Last Sync Status:', device.lastSyncStatus);
      console.log('Last Sync Error:', device.lastSyncError);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

check();
