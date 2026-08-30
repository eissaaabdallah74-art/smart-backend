// src/controllers/target-bonus.controller.js
const { TargetBonusRule, Client, VehicleType, EmployeeEmployment, Employee, Auth, Driver, DriverAttendance } = require('../models');
const { Op } = require('sequelize');

exports.getAllRules = async (req, res) => {
  try {
    const rules = await TargetBonusRule.findAll({
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name'] },
        { model: VehicleType, as: 'vehicleType', attributes: ['id', 'name'] },
      ],
      order: [['id', 'DESC']]
    });
    return res.json(rules);
  } catch (error) {
    console.error('getAllRules error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createRule = async (req, res) => {
  try {
    const { department, clientId, vehicleTypeId, ruleType, startDate, endDate, targetCount, minDaysWorked, bonusValue, isActive, requireSignedContract } = req.body;
    
    const rule = await TargetBonusRule.create({
      department: department || null,
      clientId: clientId || null,
      vehicleTypeId: vehicleTypeId || null,
      ruleType: ruleType || 'recurring_monthly',
      startDate: startDate || null,
      endDate: endDate || null,
      targetCount: Number(targetCount) || 0,
      minDaysWorked: Number(minDaysWorked) || 0,
      bonusValue: Number(bonusValue) || 0,
      requireSignedContract: typeof requireSignedContract === 'boolean' ? requireSignedContract : false,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      createdById: req.user ? req.user.id : null
    });

    const createdRule = await TargetBonusRule.findByPk(rule.id, {
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name'] },
        { model: VehicleType, as: 'vehicleType', attributes: ['id', 'name'] },
      ]
    });

    return res.status(201).json(createdRule);
  } catch (error) {
    console.error('createRule error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rule = await TargetBonusRule.findByPk(id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });

    const { department, clientId, vehicleTypeId, ruleType, startDate, endDate, targetCount, minDaysWorked, bonusValue, isActive, requireSignedContract } = req.body;

    if (typeof department !== 'undefined') rule.department = department || null;
    if (typeof clientId !== 'undefined') rule.clientId = clientId || null;
    if (typeof vehicleTypeId !== 'undefined') rule.vehicleTypeId = vehicleTypeId || null;
    if (typeof ruleType !== 'undefined') rule.ruleType = ruleType || 'recurring_monthly';
    if (typeof startDate !== 'undefined') rule.startDate = startDate || null;
    if (typeof endDate !== 'undefined') rule.endDate = endDate || null;
    if (typeof targetCount !== 'undefined') rule.targetCount = Number(targetCount) || 0;
    if (typeof minDaysWorked !== 'undefined') rule.minDaysWorked = Number(minDaysWorked) || 0;
    if (typeof bonusValue !== 'undefined') rule.bonusValue = Number(bonusValue) || 0;
    if (typeof requireSignedContract === 'boolean') rule.requireSignedContract = requireSignedContract;
    if (typeof isActive === 'boolean') rule.isActive = isActive;

    await rule.save();

    const updatedRule = await TargetBonusRule.findByPk(rule.id, {
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name'] },
        { model: VehicleType, as: 'vehicleType', attributes: ['id', 'name'] },
      ]
    });

    return res.json(updatedRule);
  } catch (error) {
    console.error('updateRule error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rule = await TargetBonusRule.findByPk(id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });

    await rule.destroy();
    return res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('deleteRule error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.evaluateRule = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { month } = req.query; // YYYY-MM
    
    const rule = await TargetBonusRule.findByPk(id, {
      include: [
        { model: Client, as: 'client' },
        { model: VehicleType, as: 'vehicleType' }
      ]
    });

    if (!rule) return res.status(404).json({ message: 'Rule not found' });

    const evalMonth = month; // Used for recurring monthly evaluation

    // Filter by Auth Role instead of Employee department
    const authWhere = {};
    if (rule.department) {
      authWhere.role = rule.department;
    }

    const employees = await Employee.findAll({
      include: [
        { model: EmployeeEmployment, as: 'employment', required: false },
        { model: Auth, as: 'account', where: authWhere, required: true }
      ]
    });

    const eligibleEmployees = [];

    for (const emp of employees) {
      const authUserId = emp.account.id;
      
      const driverWhere = {
        createdById: authUserId,
      };

      if (rule.ruleType === 'custom_period') {
        if (rule.startDate && rule.endDate) {
          driverWhere.day1Date = { [Op.between]: [rule.startDate, rule.endDate] };
        } else if (rule.startDate) {
          driverWhere.day1Date = { [Op.gte]: rule.startDate };
        } else if (rule.endDate) {
          driverWhere.day1Date = { [Op.lte]: rule.endDate };
        }
      } else {
        // recurring_monthly
        if (!evalMonth) {
          return res.status(400).json({ message: 'Evaluation month is required for recurring_monthly rules' });
        }
        
        const [yearStr, monthStr] = evalMonth.split('-');
        const year = parseInt(yearStr, 10);
        const monthIdx = parseInt(monthStr, 10);
        
        const startOfMonth = `${year}-${String(monthIdx).padStart(2, '0')}-01`;
        const endOfMonth = new Date(year, monthIdx, 0).toISOString().split('T')[0];

        driverWhere.day1Date = { [Op.between]: [startOfMonth, endOfMonth] };
      }

      if (rule.client) {
        driverWhere.clientName = rule.client.name;
      }
      if (rule.vehicleType) {
        driverWhere.vehicleType = rule.vehicleType.name;
      }

      if (rule.requireSignedContract) {
        driverWhere[Op.or] = [
          { signedWithHr: 'Signed A Contract With HR' },
          { signed: true }
        ];
      }

      const drivers = await Driver.findAll({
        where: driverWhere,
        attributes: ['id', 'day1Date']
      });

      let validDriversCount = 0;
      
      for (const d of drivers) {
        if (rule.minDaysWorked > 0) {
          const attendanceCount = await DriverAttendance.count({
            where: {
              driverId: d.id,
              status: 'present'
            }
          });
          
          if (attendanceCount >= rule.minDaysWorked) {
            validDriversCount++;
          }
        } else {
          validDriversCount++;
        }
      }

      if (validDriversCount >= rule.targetCount) {
        eligibleEmployees.push({
          employeeId: emp.id,
          employeeName: emp.fullName,
          department: emp.account.role, // show the system role
          validDriversCount,
          targetCount: rule.targetCount,
          bonusValue: rule.bonusValue
        });
      }
    }

    return res.json({
      rule,
      eligibleEmployees
    });

  } catch (error) {
    console.error('evaluateRule error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
