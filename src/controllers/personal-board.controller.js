// src/controllers/personal-board.controller.js
const { Auth, Employee, Payroll, EmployeeLoan, UserTask, Call, EmployeeEmployment, EmployeeDocument, EmployeeEducation, EmployeeEvaluation, AttendanceDay } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const moment = require('moment');

exports.getProfile = async (req, res) => {
  try {
    const authId = req.user.id;

    // Fetch Auth User
    const authUser = await Auth.findByPk(authId, {
      attributes: ['id', 'fullName', 'email', 'role', 'position', 'hireDate', 'interviewTarget', 'kpiAmount', 'profileImage'],
    });

    if (!authUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Try to fetch linked Employee with all HR data
    const employee = await Employee.findOne({
      where: { authUserId: authId },
      include: [
        { model: EmployeeEmployment, as: 'employment' },
        { model: EmployeeDocument, as: 'documents' },
        { model: EmployeeEducation, as: 'educations' },
        { model: EmployeeEvaluation, as: 'evaluations' },
        {
          model: EmployeeLoan,
          as: 'loans',
          where: {
            status: { [Op.in]: ['approved', 'disbursed'] } // Active loans
          },
          required: false,
        }
      ]
    });

    // If Employee is linked, try to fetch their latest payroll
    let recentPayrolls = [];
    if (employee) {
      recentPayrolls = await Payroll.findAll({
        where: { employeeId: employee.id },
        order: [['year', 'DESC'], ['month', 'DESC']],
        limit: 12, // For annual overview
      });
    }

    // Fetch today's attendance for the shift timer
    let todayClockIn = null;
    if (employee) {
      const todayString = moment().format('YYYY-MM-DD');
      const attendance = await AttendanceDay.findOne({
        where: {
          employeeId: employee.id,
          date: todayString,
          clockIn: { [Op.not]: null }
        }
      });
      if (attendance) {
        todayClockIn = attendance.clockIn;
      }
    }

    return res.json({
      auth: authUser,
      employee: employee || null,
      payrolls: recentPayrolls,
      activeLoans: employee ? employee.loans : [],
      todayClockIn: todayClockIn
    });
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// --- Tasks ---
exports.getTasks = async (req, res) => {
  try {
    const authId = req.user.id;
    const type = req.query.type; // 'todo', 'daily_plan', 'monthly_plan'

    const whereClause = { authId };
    if (type) whereClause.type = type;

    const tasks = await UserTask.findAll({
      where: whereClause,
      order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
    });

    return res.json(tasks);
  } catch (error) {
    console.error('getTasks error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const authId = req.user.id;
    const { title, description, status, dueDate, startTime, endTime, type, referenceId, referenceType } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const task = await UserTask.create({
      authId,
      title,
      description,
      status: status || 'pending',
      dueDate: dueDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
      type: type || 'todo',
      referenceId: referenceId || null,
      referenceType: referenceType || null,
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const authId = req.user.id;
    const taskId = req.params.id;

    const task = await UserTask.findOne({ where: { id: taskId, authId } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { title, description, status, dueDate, startTime, endTime, type, referenceId, referenceType } = req.body;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (startTime !== undefined) task.startTime = startTime;
    if (endTime !== undefined) task.endTime = endTime;
    if (type !== undefined) task.type = type;
    if (referenceId !== undefined) task.referenceId = referenceId;
    if (referenceType !== undefined) task.referenceType = referenceType;

    await task.save();
    return res.json(task);
  } catch (error) {
    console.error('updateTask error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const authId = req.user.id;
    const taskId = req.params.id;

    const task = await UserTask.findOne({ where: { id: taskId, authId } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.destroy();
    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('deleteTask error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// --- Personal Calls ---
exports.getMyCalls = async (req, res) => {
  try {
    const authId = req.user.id;

    const calls = await Call.findAll({
      where: {
        // Filter where this user is the assignee or the creator
        [Op.or]: [
          { assignee_id: authId },
          { created_by_id: authId }
        ]
      },
      order: [['created_at', 'DESC']],
      limit: 1000,
    });

    return res.json(calls);
  } catch (error) {
    console.error('getMyCalls error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// --- Change Password ---
exports.changePassword = async (req, res) => {
  try {
    const authId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    const authUser = await Auth.findByPk(authId);
    if (!authUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, authUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    authUser.password = hashedPassword;
    await authUser.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
