// src/services/zkteco-client.service.js
const ZKLib = require("node-zklib");

class ZktecoClientService {
  constructor(ipAddress, port = 4370, timeout = 10000, inport = 5200) {
    this.ipAddress = ipAddress;
    this.port = port;
    this.timeout = timeout;
    this.inport = inport;
    this.zkInstance = null;
  }

  async connect() {
    try {
      this.zkInstance = new ZKLib(this.ipAddress, this.port, this.timeout, this.inport);
      await this.zkInstance.createSocket();
      return true;
    } catch (error) {
      console.error(`Failed to connect to ZKTeco device at ${this.ipAddress}:${this.port}`, error);
      throw new Error(`ZKTeco Connection Error: ${error.message}`);
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
}

module.exports = ZktecoClientService;
