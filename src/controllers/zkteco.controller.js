// src/controllers/zkteco.controller.js
const { AttendanceDevice, AttendanceDeviceUser } = require("../models");
const attendanceSyncService = require("../services/attendance-sync.service");
const attendanceReportsService = require("../services/attendance-reports.service");

exports.createDevice = async (req, res) => {
  try {
    const device = await AttendanceDevice.create(req.body);
    res.status(201).json({ success: true, data: device });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getDevices = async (req, res) => {
  try {
    const devices = await AttendanceDevice.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const device = await AttendanceDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, error: 'Device not found' });
    
    await device.update(req.body);
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const device = await AttendanceDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, error: 'Device not found' });
    
    await device.destroy();
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ZKTeco Actions
exports.testConnection = async (req, res) => {
  try {
    const result = await attendanceSyncService.testConnection(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.syncUsers = async (req, res) => {
  try {
    const result = await attendanceSyncService.syncDeviceUsers(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.syncLogs = async (req, res) => {
  try {
    const result = await attendanceSyncService.syncDeviceLogs(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.syncAll = async (req, res) => {
  try {
    const result = await attendanceSyncService.syncAll(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reports and Data Access
exports.getRawLogs = async (req, res) => {
  try {
    const result = await attendanceReportsService.getRawLogs(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const result = await attendanceReportsService.getDailySummary(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getDeviceUsers = async (req, res) => {
  try {
    const { deviceId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    if (deviceId) whereClause.attendanceDeviceId = deviceId;
    
    const { count, rows } = await AttendanceDeviceUser.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['name', 'ASC']]
    });
    
    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
