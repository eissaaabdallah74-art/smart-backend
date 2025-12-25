// src/controllers/call.controller.js
const { Op } = require('sequelize');
const { Call, Auth, Client } = require('../models');
const {
  isOperationManagerOrSupervisor,
} = require('../middlewares/role.helpers');

// ===== Helper: build where/filter =====
function buildCallWhereQuery(query) {
  const where = {};
  const {
    assigneeId,
    status,
    fromDate,
    toDate,
    q,
    smartOrSmv,
  } = query;

  if (assigneeId) where.assignee_id = Number(assigneeId);
  if (status) where.status = status;
  if (smartOrSmv) where.smart_or_smv = smartOrSmv;

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date[Op.gte] = new Date(fromDate);
    if (toDate) where.date[Op.lte] = new Date(toDate);
  }

  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { phone: { [Op.like]: `%${q}%` } },
      { vehicle_type: { [Op.like]: `%${q}%` } },
      { government: { [Op.like]: `%${q}%` } },
      { comment: { [Op.like]: `%${q}%` } },
      { second_call_comment: { [Op.like]: `%${q}%` } },
    ];
  }

  return where;
}

// ============== GET /api/calls/operation-staff ==============
exports.getOperationStaff = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === '1';

    const where = { role: 'operation' };
    if (!includeInactive) {
      where.isActive = true;
    }

    const staff = await Auth.findAll({
      where,
      attributes: ['id', 'fullName', 'email', 'role', 'position', 'isActive'],
      order: [['fullName', 'ASC']],
    });

    return res.json(staff);
  } catch (error) {
    console.error('getOperationStaff error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== GET /api/calls (Manager/Supervisor/Admin) ==============
exports.getAllCallsForManager = async (req, res) => {
  try {
    const { page = 1, pageSize = 50, sortBy = 'date', sortDir = 'ASC' } =
      req.query;

    const where = buildCallWhereQuery(req.query);

    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const result = await Call.findAndCountAll({
      where,
      include: [
        {
          model: Auth,
          as: 'assignee',
          attributes: ['id', 'fullName', 'email', 'role', 'position'],
        },
        {
          model: Auth,
          as: 'createdBy',
          attributes: ['id', 'fullName', 'email'],
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name'],
        },
      ],
      order: [[sortBy, sortDir]],
      limit,
      offset,
    });

    return res.json({
      rows: result.rows,
      count: result.count,
      page: Number(page),
      pageSize: limit,
    });
  } catch (error) {
    console.error('getAllCallsForManager error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== GET /api/calls/by-assignee/:id ==============
exports.getCallsByAssignee = async (req, res) => {
  try {
    const assigneeId = Number(req.params.id);
    if (Number.isNaN(assigneeId)) {
      return res.status(400).json({ message: 'Invalid assignee id' });
    }

    const where = buildCallWhereQuery(req.query);
    where.assignee_id = assigneeId;

    const calls = await Call.findAll({
      where,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name'],
        },
      ],
      order: [['date', 'ASC']],
    });

    return res.json(calls);
  } catch (error) {
    console.error('getCallsByAssignee error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== GET /api/calls/my/all ==============
exports.getMyCalls = async (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'operation' && user.role !== 'admin')) {
      return res.status(403).json({ message: 'Operation staff only' });
    }

    const where = buildCallWhereQuery(req.query);
    where.assignee_id = user.id;

    const calls = await Call.findAll({
      where,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name'],
        },
      ],
      order: [['date', 'ASC']],
    });

    return res.json(calls);
  } catch (error) {
    console.error('getMyCalls error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== POST /api/calls (create one) ==============
exports.createCall = async (req, res) => {
  try {
    const user = req.user;

    if (!(user.role === 'admin' || isOperationManagerOrSupervisor(user))) {
      return res.status(403).json({
        message: 'Only operation manager/supervisor or admin can create calls',
      });
    }

    const {
      clientId,
      assigneeId,
      title,
      vehicleType,
      date,
      status,
      outcome,
      phone,
      address,
      whatsappStatus,
      comment,
      notes,
    } = req.body;

    if (!assigneeId) {
      return res.status(400).json({ message: 'assigneeId is required' });
    }

    const assignee = await Auth.findByPk(assigneeId);
    if (!assignee) {
      return res.status(400).json({ message: 'Assignee not found' });
    }
    if (assignee.role !== 'operation') {
      return res
        .status(400)
        .json({ message: 'Assignee must be operation user' });
    }

    const call = await Call.create({
      client_id: clientId || null,
      assignee_id: assigneeId,
      created_by_id: user.id,
      title: title || null,
      vehicle_type: vehicleType || null,
      date: date ? new Date(date) : null,
      status: status || 'pending',
      outcome: outcome || null,
      phone: phone || null,
      address: address || null,
      whatsapp_status: whatsappStatus || null,
      comment: comment || null,
      notes: notes || null,
    });

    return res.status(201).json(call);
  } catch (error) {
    console.error('createCall error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== POST /api/calls/import (bulk) ==============
exports.bulkImportCalls = async (req, res) => {
  try {
    const user = req.user;

    if (!(user.role === 'admin' || isOperationManagerOrSupervisor(user))) {
      return res.status(403).json({
        message: 'Only operation manager/supervisor or admin can import calls',
      });
    }

    let { rows, assigneeId, assigneeIds } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'rows array is required' });
    }

    // --------- Normalize assigneeIds ---------
    let assigneeIdList = [];

    if (Array.isArray(assigneeIds) && assigneeIds.length > 0) {
      assigneeIdList = assigneeIds
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));
    } else if (assigneeId) {
      const idNum = Number(assigneeId);
      if (!Number.isNaN(idNum)) {
        assigneeIdList = [idNum];
      }
    }

    if (!assigneeIdList.length) {
      return res.status(400).json({
        message: 'assigneeId or assigneeIds is required',
      });
    }

    // نجيب كل الـ operation staff مرة واحدة
    const staff = await Auth.findAll({
      where: {
        id: assigneeIdList,
        role: 'operation',
      },
    });

    if (!staff.length) {
      return res
        .status(400)
        .json({ message: 'No valid operation staff for given assigneeIds' });
    }

    const staffCount = staff.length;
    const allowedStatuses = ['pending', 'completed', 'cancelled', 'rescheduled'];

    const errors = [];
    const created = [];

    // --------- توزيع الـ rows بالتساوي (round-robin) على الـ staff ---------
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const {
          date,
          name,
          phone,
          vehicle_type,
          government,
          call_feedback,
          whatsapp_status,
          comment,
          smart_or_smv,
          second_call_comment,
          status,
        } = row;

        // parse date
        let dateVal = null;
        if (date) {
          const d = new Date(date);
          if (!Number.isNaN(d.getTime())) {
            dateVal = d;
          }
        }

        // status
        let finalStatus = 'pending';
        if (status && allowedStatuses.includes(status)) {
          finalStatus = status;
        }

        // assignee بالتناوب
        const assignee = staff[i % staffCount];

        const call = await Call.create({
          client_id: null,
          assignee_id: assignee.id,
          created_by_id: user.id,
          date: dateVal,
          name: name || null,
          phone: phone || null,
          vehicle_type: vehicle_type || null,
          government: government || null,
          call_feedback: call_feedback || null,
          whatsapp_status: whatsapp_status || null,
          comment: comment || null,
          smart_or_smv: smart_or_smv || null,
          second_call_comment: second_call_comment || null,
          status: finalStatus,
        });

        created.push(call);
      } catch (e) {
        errors.push({
          index: i,
          message: e.message || 'Unknown error',
          row,
        });
      }
    }

    return res.json({
      createdCount: created.length,
      errorCount: errors.length,
      errors,
    });
  } catch (error) {
    console.error('bulkImportCalls error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// ============== PATCH /api/calls/:id (update) ==============
exports.updateCall = async (req, res) => {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid call id' });
    }

    const call = await Call.findByPk(id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const isManager =
      user && (user.role === 'admin' || isOperationManagerOrSupervisor(user));
    const isAssignee = user && user.id === call.assignee_id;

    if (!isManager && !isAssignee) {
      return res
        .status(403)
        .json({ message: 'Not allowed to update this call' });
    }

    const {
      date,
      name,
      phone,
      vehicle_type,
      government,
      call_feedback,
      whatsapp_status,
      comment,
      smart_or_smv,
      second_call_comment,
      status,
    } = req.body;

    // لو Assignee فقط → يعدل الحاجات اللي بيشتغل عليها
    if (!isManager && isAssignee) {
      if (typeof status !== 'undefined') call.status = status;
      if (typeof call_feedback !== 'undefined')
        call.call_feedback = call_feedback;
      if (typeof whatsapp_status !== 'undefined')
        call.whatsapp_status = whatsapp_status;
      if (typeof comment !== 'undefined') call.comment = comment;
      if (typeof second_call_comment !== 'undefined')
        call.second_call_comment = second_call_comment;

      await call.save();
      return res.json(call);
    }

    // Manager/Supervisor/Admin: يقدر يعدل كل حاجة
    if (typeof date !== 'undefined') {
      call.date = date ? new Date(date) : null;
    }
    if (typeof name !== 'undefined') call.name = name;
    if (typeof phone !== 'undefined') call.phone = phone;
    if (typeof vehicle_type !== 'undefined') call.vehicle_type = vehicle_type;
    if (typeof government !== 'undefined') call.government = government;
    if (typeof call_feedback !== 'undefined')
      call.call_feedback = call_feedback;
    if (typeof whatsapp_status !== 'undefined')
      call.whatsapp_status = whatsapp_status;
    if (typeof comment !== 'undefined') call.comment = comment;
    if (typeof smart_or_smv !== 'undefined') call.smart_or_smv = smart_or_smv;
    if (typeof second_call_comment !== 'undefined')
      call.second_call_comment = second_call_comment;
    if (typeof status !== 'undefined') call.status = status;

    await call.save();
    return res.json(call);
  } catch (error) {
    console.error('updateCall error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ============== DELETE /api/calls/:id ==============
exports.deleteCall = async (req, res) => {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid call id' });
    }

    const call = await Call.findByPk(id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // لازم يكون Manager/Supervisor/Admin أو Assignee
    const isManager =
      user && (user.role === 'admin' || isOperationManagerOrSupervisor(user));
    const isAssignee = user && user.id === call.assignee_id;

    if (!isManager && !isAssignee) {
      return res
        .status(403)
        .json({ message: 'Not allowed to delete this call' });
    }
    await call.destroy();
    return res.json({ message: 'Call deleted successfully' });
  } catch (error) {
    console.error('deleteCall error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};