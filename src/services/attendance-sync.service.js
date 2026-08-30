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

        // Chunk to prevent MySQL packet size limit
        const chunkSize = 200;
        for (let i = 0; i < usersToUpsert.length; i += chunkSize) {
          const chunk = usersToUpsert.slice(i, i + chunkSize);
          await AttendanceDeviceUser.bulkCreate(chunk, {
            updateOnDuplicate: ['uid', 'name', 'role', 'cardNo', 'rawPayload', 'lastPulledAt', 'updated_at']
          });
        }
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
      console.log("Connecting...");
      await client.connect();
      console.log("Connected.");

      console.log("Reading attendances...");
      const rawLogs = await client.getAttendances();
      console.log("Attendance count:", rawLogs ? rawLogs.length : 0);

      if (rawLogs && rawLogs.length > 0) {
        // Filter out very old logs to speed up sync and prevent DB bloat
        const now = new Date();
        // Cutoff is the 1st of the PREVIOUS month to ensure we always have recent data
        const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
        })).filter(log => {
          if (!log.deviceUserId || !log.punchTime) return false;
          const logDate = new Date(log.punchTime);
          return logDate >= cutoffDate;
        });

        console.log(`Filtered logs to insert (since ${cutoffDate.toISOString().split('T')[0]}):`, logsToInsert.length);

        // Chunk logs to avoid max_allowed_packet error
        const chunkSize = 200;
        for (let i = 0; i < logsToInsert.length; i += chunkSize) {
          const chunk = logsToInsert.slice(i, i + chunkSize);
          await AttendanceRawLog.bulkCreate(chunk, {
            ignoreDuplicates: true
          });
        }
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
      console.error("ERROR DURING SYNC:", error);
      throw error;
    } finally {
      console.log("STEP 4 - Disconnect");
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

  /**
   * Push a user to the device
   */
  async pushUserToDevice(deviceId, userData) {
    const device = await AttendanceDevice.findByPk(deviceId);
    if (!device) throw new Error("Device not found");

    const client = new ZktecoClientService(device.ipAddress, device.port);
    try {
      await client.connect();
      const { uid, deviceUserId, name, password, role, cardNo } = userData;
      await client.setUser(
        parseInt(uid, 10), 
        deviceUserId, 
        name, 
        password || '', 
        parseInt(role, 10) || 0, 
        parseInt(cardNo, 10) || 0
      );
      return { success: true };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Delete a user from the device
   */
  async deleteUserFromDevice(deviceId, uid) {
    const device = await AttendanceDevice.findByPk(deviceId);
    if (!device) throw new Error("Device not found");

    const client = new ZktecoClientService(device.ipAddress, device.port);
    try {
      await client.connect();
      await client.deleteUser(parseInt(uid, 10));
      return { success: true };
    } finally {
      await client.disconnect();
    }
  }
}

module.exports = new AttendanceSyncService();
