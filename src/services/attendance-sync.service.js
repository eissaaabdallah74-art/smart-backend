// src/services/attendance-sync.service.js
const { AttendanceDevice, AttendanceDeviceUser, AttendanceRawLog } = require("../models");
const ZktecoClientService = require("./zkteco-client.service");

class AttendanceSyncService {
  /**
   * Sync users from device to database
   * @param {number} deviceId
   */
  async syncDeviceUsers(deviceId) {
    const device = await AttendanceDevice.findByPk(deviceId);
    if (!device) throw new Error("Device not found");

    const client = new ZktecoClientService(device.ipAddress, device.port);
    try {
      await client.connect();
      const rawUsers = await client.getUsers();

      if (rawUsers && rawUsers.length > 0) {
        const usersToUpsert = rawUsers.map(user => ({
          attendanceDeviceId: device.id,
          deviceUserId: user.userId || user.uid?.toString(),
          uid: user.uid?.toString(),
          name: user.name,
          role: user.role?.toString(),
          cardNo: user.cardno?.toString(),
          rawPayload: user,
          lastPulledAt: new Date()
        }));

        await AttendanceDeviceUser.bulkCreate(usersToUpsert, {
          updateOnDuplicate: ['uid', 'name', 'role', 'cardNo', 'rawPayload', 'lastPulledAt', 'updated_at']
        });
      }

      await device.update({
        lastSyncAt: new Date(),
        lastSyncStatus: "SUCCESS",
        lastSyncError: null,
      });

      return { success: true, count: rawUsers.length };
    } catch (error) {
      await device.update({
        lastSyncStatus: "FAILED",
        lastSyncError: error.message,
      });
      throw error;
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Sync attendance logs from device to database
   * @param {number} deviceId
   */
  async syncDeviceLogs(deviceId) {
    const device = await AttendanceDevice.findByPk(deviceId);
    if (!device) throw new Error("Device not found");

    const client = new ZktecoClientService(device.ipAddress, device.port);
    try {
      await client.connect();
      const rawLogs = await client.getAttendances();

      if (rawLogs && rawLogs.length > 0) {
        const logsToInsert = rawLogs.map(log => ({
          attendanceDeviceId: device.id,
          deviceUserId: log.deviceUserId || log.userSn || log.uid?.toString(),
          uid: log.uid?.toString(),
          punchTime: log.recordTime || log.timestamp,
          verifyType: log.verifyType?.toString(),
          status: log.inOutStatus?.toString() || log.status?.toString(),
          workCode: log.workCode?.toString(),
          rawPayload: log,
          syncedAt: new Date()
        })).filter(log => log.deviceUserId && log.punchTime); // Ensure required fields exist

        // Use ignoreDuplicates to avoid unique constraint errors (Requires MySQL INSERT IGNORE)
        await AttendanceRawLog.bulkCreate(logsToInsert, {
          ignoreDuplicates: true
        });
      }

      await device.update({
        lastSyncAt: new Date(),
        lastSyncStatus: "SUCCESS",
        lastSyncError: null,
      });

      return { success: true, count: rawLogs.length };
    } catch (error) {
      await device.update({
        lastSyncStatus: "FAILED",
        lastSyncError: error.message,
      });
      throw error;
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Test connection to a device
   * @param {number} deviceId 
   */
  async testConnection(deviceId) {
    const device = await AttendanceDevice.findByPk(deviceId);
    if (!device) throw new Error("Device not found");

    const client = new ZktecoClientService(device.ipAddress, device.port);
    try {
      await client.connect();
      const info = await client.getInfo();
      return { success: true, info };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Sync both users and logs
   * @param {number} deviceId
   */
  async syncAll(deviceId) {
    const usersResult = await this.syncDeviceUsers(deviceId);
    const logsResult = await this.syncDeviceLogs(deviceId);
    
    return {
      success: true,
      users: usersResult.count,
      logs: logsResult.count
    };
  }
}

module.exports = new AttendanceSyncService();
