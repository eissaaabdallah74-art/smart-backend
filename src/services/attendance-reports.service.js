// src/services/attendance-reports.service.js
const { AttendanceRawLog, AttendanceDeviceUser, EmployeeDeviceMapping, Employee, AttendanceDevice } = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/db.config");

class AttendanceReportsService {
  /**
   * Get Daily Summary of attendances
   */
  async getDailySummary(filters) {
    const { deviceId, fromDate, toDate, deviceUserId, search, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (deviceId) whereClause.attendanceDeviceId = deviceId;
    if (deviceUserId) whereClause.deviceUserId = deviceUserId;
    if (fromDate && toDate) {
      whereClause.punchTime = {
        [Op.between]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
      };
    } else if (fromDate) {
      whereClause.punchTime = { [Op.gte]: new Date(fromDate + " 00:00:00") };
    } else if (toDate) {
      whereClause.punchTime = { [Op.lte]: new Date(toDate + " 23:59:59") };
    }

    // Group logs by DATE(punchTime), deviceUserId, and attendanceDeviceId
    const summary = await AttendanceRawLog.findAll({
      where: whereClause,
      attributes: [
        'attendanceDeviceId',
        'deviceUserId',
        [sequelize.fn('DATE', sequelize.col('punch_time')), 'workDate'],
        [sequelize.fn('MIN', sequelize.col('punch_time')), 'firstPunchTime'],
        [sequelize.fn('MAX', sequelize.col('punch_time')), 'lastPunchTime'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'punchesCount'],
      ],
      group: ['attendanceDeviceId', 'deviceUserId', sequelize.fn('DATE', sequelize.col('punch_time'))],
      order: [[sequelize.fn('DATE', sequelize.col('punch_time')), 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      include: [
        {
          model: AttendanceDevice,
          as: 'device',
          attributes: ['name', 'ipAddress']
        }
      ],
      raw: true,
      nest: true
    });

    // We can fetch names from AttendanceDeviceUser manually to avoid complex joins in group by
    const enrichedSummary = await Promise.all(summary.map(async (row) => {
      const user = await AttendanceDeviceUser.findOne({
        where: {
          attendanceDeviceId: row.attendanceDeviceId,
          deviceUserId: row.deviceUserId
        },
        attributes: ['name']
      });

      const mapping = await EmployeeDeviceMapping.findOne({
        where: {
          attendanceDeviceId: row.attendanceDeviceId,
          deviceUserId: row.deviceUserId
        },
        include: [{ model: Employee, as: 'employee', attributes: ['id'] }]
      });

      return {
        ...row,
        deviceUserName: user ? user.name : null,
        mappedEmployeeId: mapping && mapping.employee ? mapping.employee.id : null
      };
    }));

    // For total count in group by, we can run a separate count query or just return the length if it's simple
    // A proper count query for group by is complex, we will just return the array length as an approximation 
    // or use a subquery if pagination is strict. For now, returning length + offset.
    return {
      data: enrichedSummary,
      total: enrichedSummary.length, // Placeholder, accurate total requires complex subquery
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };
  }

  async getRawLogs(filters) {
    const { deviceId, deviceUserId, fromDate, toDate, search, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (deviceId) whereClause.attendanceDeviceId = deviceId;
    if (deviceUserId) whereClause.deviceUserId = deviceUserId;
    if (fromDate && toDate) {
      whereClause.punchTime = {
        [Op.between]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
      };
    } else if (fromDate) {
      whereClause.punchTime = { [Op.gte]: new Date(fromDate + " 00:00:00") };
    } else if (toDate) {
      whereClause.punchTime = { [Op.lte]: new Date(toDate + " 23:59:59") };
    }

    const { count, rows } = await AttendanceRawLog.findAndCountAll({
      where: whereClause,
      order: [['punchTime', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      include: [
        {
          model: AttendanceDevice,
          as: 'device',
          attributes: ['name', 'ipAddress']
        }
      ]
    });

    // Fetch names for each log
    const enrichedRows = await Promise.all(rows.map(async (row) => {
      const data = row.toJSON();
      const user = await AttendanceDeviceUser.findOne({
        where: {
          attendanceDeviceId: data.attendanceDeviceId,
          deviceUserId: data.deviceUserId
        },
        attributes: ['name']
      });
      data.deviceUserName = user ? user.name : null;
      return data;
    }));

    return {
      data: enrichedRows,
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };
  }
}

module.exports = new AttendanceReportsService();
