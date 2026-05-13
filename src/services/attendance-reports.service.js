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

    try {
      // Group logs by DATE(punchTime), deviceUserId, and attendanceDeviceId
      const summary = await AttendanceRawLog.findAll({
        where: whereClause,
        attributes: [
          'attendanceDeviceId',
          'deviceUserId',
          [sequelize.literal('DATE(punch_time)'), 'workDate'],
          [sequelize.fn('MIN', sequelize.col('punch_time')), 'firstPunchTime'],
          [sequelize.fn('MAX', sequelize.col('punch_time')), 'lastPunchTime'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'punchesCount'],
        ],
        group: [
          'attendance_device_id', 
          'device_user_id', 
          sequelize.literal('DATE(punch_time)')
        ],
        order: [[sequelize.literal('DATE(punch_time)'), 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        raw: true
      });

      // Enriched data
      const enrichedSummary = await Promise.all(summary.map(async (row) => {
        const device = await AttendanceDevice.findByPk(row.attendanceDeviceId, {
          attributes: ['name', 'ipAddress']
        });

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
          include: [{ model: Employee, as: 'employee', attributes: ['id', 'nationalId'] }]
        });
        
        return {
          ...row,
          device,
          deviceUserName: user ? user.name : null,
          mappedEmployeeId: mapping && mapping.employee ? mapping.employee.id : null,
          nationalId: mapping && mapping.employee ? mapping.employee.nationalId : null
        };
      }));

      return {
        data: enrichedSummary,
        total: enrichedSummary.length,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error("ERROR IN getDailySummary:", error);
      throw error;
    }
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

    // Fetch names and calculate IN/OUT status for each log
    const logsByUserAndDay = {};

    const enrichedRows = await Promise.all(rows.map(async (row) => {
      const data = row.toJSON();
      
      // Fetch Device User Name
      const user = await AttendanceDeviceUser.findOne({
        where: {
          attendanceDeviceId: data.attendanceDeviceId,
          deviceUserId: data.deviceUserId
        },
        attributes: ['name']
      });
      data.deviceUserName = user ? user.name : null;

      // Add nationalId from mapped employee
      const mapping = await EmployeeDeviceMapping.findOne({
        where: {
          attendanceDeviceId: data.attendanceDeviceId,
          deviceUserId: data.deviceUserId
        },
        include: [{ model: Employee, as: 'employee', attributes: ['nationalId'] }]
      });
      data.nationalId = mapping && mapping.employee ? mapping.employee.nationalId : null;

      // Calculate IN/OUT if not provided by device
      if (!data.status || data.status === 'null' || data.status === '—') {
        const dateKey = new Date(data.punchTime).toISOString().split('T')[0];
        const userKey = `${data.attendanceDeviceId}-${data.deviceUserId}`;
        const dayKey = `${userKey}-${dateKey}`;

        if (!logsByUserAndDay[dayKey]) {
          // Fetch all logs for this user on this day to determine order
          const dayLogs = await AttendanceRawLog.findAll({
            where: {
              attendanceDeviceId: data.attendanceDeviceId,
              deviceUserId: data.deviceUserId,
              punchTime: {
                [Op.between]: [new Date(dateKey + " 00:00:00"), new Date(dateKey + " 23:59:59")]
              }
            },
            order: [['punchTime', 'ASC']],
            attributes: ['id']
          });
          logsByUserAndDay[dayKey] = dayLogs.map(l => l.id);
        }

        const index = logsByUserAndDay[dayKey].indexOf(data.id);
        if (index !== -1) {
          data.calculatedStatus = (index % 2 === 0) ? 'CHECK-IN' : 'CHECK-OUT';
        }
      } else {
        data.calculatedStatus = data.status;
      }

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
