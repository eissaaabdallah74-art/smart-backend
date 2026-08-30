// src/services/zkteco-client.service.js
const ZKLib = require("zkh-lib");

class ZktecoClientService {
  constructor(ipAddress, port = 4370, timeout = 10000, inport = 5209) {
    this.ipAddress = ipAddress;
    this.port = port;
    this.timeout = timeout;
    this.inport = inport;
    this.zkInstance = null;
  }

  async connect() {
    try {
      console.log("1. Creating ZKLib instance...");

      this.zkInstance = new ZKLib(
        this.ipAddress,
        this.port,
        this.timeout,
        this.inport
      );

      console.log("2. Calling createSocket()...");

      await this.zkInstance.createSocket();

      console.log("3. Socket connected successfully.");

      return true;
    } catch (error) {
      console.error("CONNECT ERROR");
      console.error(error);
      console.error(error.stack);

      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.zkInstance) {
        await this.zkInstance.disconnect();
        this.zkInstance = null;
      }
    } catch (error) {
      console.error(`Error disconnecting from ZKTeco device:`, error);
    }
  }

  async getUsers() {
    try {
      if (!this.zkInstance) throw new Error("Device not connected");
      const users = await this.zkInstance.getUsers();
      return users.data || [];
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  async getAttendances() {
    try {
      if (!this.zkInstance) throw new Error("Device not connected");
      const attendances = await this.zkInstance.getAttendances();
      return attendances.data || [];
    } catch (error) {
      throw new Error(`Failed to get attendances: ${error.message}`);
    }
  }

  async getInfo() {
    try {
      if (!this.zkInstance) throw new Error("Device not connected");
      const info = await this.zkInstance.getInfo();
      return info;
    } catch (error) {
      return null;
    }
  }

  async setUser(uid, userId, name, password = "", role = 0, cardno = 0) {
    try {
      if (!this.zkInstance) throw new Error("Device not connected");
      return await this.zkInstance.setUser(uid, userId, name, password, role, cardno);
    } catch (error) {
      throw new Error(`Failed to set user: ${error.message}`);
    }
  }

  async deleteUser(uid) {
    try {
      if (!this.zkInstance) throw new Error("Device not connected");
      return await this.zkInstance.deleteUser(uid);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

module.exports = ZktecoClientService;
