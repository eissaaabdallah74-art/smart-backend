const { Custody, Driver, Employee, EmployeeEmployment, CustodyItem } = require('../models');
const { Op } = require('sequelize');

exports.createCustody = async (req, res) => {
  try {
    const {
      custodyType,
      custodyItemId,
      deliveryDate,
      recipientType,
      employeeId,
      driverId,
      notes,
    } = req.body;

    if ((!custodyType && !custodyItemId) || !deliveryDate || !recipientType) {
      return res.status(400).json({ message: 'custodyType/custodyItemId, deliveryDate and recipientType are required' });
    }

    let department = null;
    let company = null;

    if (recipientType === 'employee') {
      if (!employeeId) return res.status(400).json({ message: 'employeeId is required for employee recipient' });
      const emp = await Employee.findByPk(employeeId, {
        include: [{ model: EmployeeEmployment, as: 'employment' }]
      });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });
      department = emp.employment ? emp.employment.department : null;
    } else if (recipientType === 'driver') {
      if (!driverId) return res.status(400).json({ message: 'driverId is required for driver recipient' });
      const drv = await Driver.findByPk(driverId);
      if (!drv) return res.status(404).json({ message: 'Courier/Driver not found' });
      company = drv.clientName;
    } else {
      return res.status(400).json({ message: 'Invalid recipientType' });
    }

    let finalCustodyType = custodyType;
    let dbCustodyItemId = custodyItemId || null;

    if (custodyItemId) {
      const cItem = await CustodyItem.findByPk(custodyItemId);
      if (!cItem) return res.status(404).json({ message: 'Custody item not found' });
      cItem.status = 'assigned';
      await cItem.save();
      finalCustodyType = cItem.name;
    }

    const custody = await Custody.create({
      custodyType: finalCustodyType,
      custodyItemId: dbCustodyItemId,
      deliveryDate,
      recipientType,
      employeeId: recipientType === 'employee' ? employeeId : null,
      driverId: recipientType === 'driver' ? driverId : null,
      department,
      company,
      notes,
      status: 'delivered'
    });

    // Reload with associations
    const reloaded = await Custody.findByPk(custody.id, {
      include: [
        { model: Driver, as: 'driver', attributes: ['id', 'name', 'courierPhone', 'clientName', 'nationalId'] },
        { model: Employee, as: 'employee', attributes: ['id', 'fullName', 'nationalId'] },
        { model: CustodyItem, as: 'custodyItem' },
        { model: CustodyItem, as: 'replacementCustodyItem' }
      ]
    });

    return res.status(201).json(reloaded);
  } catch (error) {
    console.error('createCustody error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllCustodies = async (req, res) => {
  try {
    const custodies = await Custody.findAll({
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ['id', 'name', 'courierPhone', 'clientName', 'nationalId']
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'fullName', 'nationalId']
        },
        {
          model: CustodyItem,
          as: 'custodyItem'
        },
        {
          model: CustodyItem,
          as: 'replacementCustodyItem'
        }
      ],
      order: [['id', 'DESC']]
    });

    return res.json(custodies);
  } catch (error) {
    console.error('getAllCustodies error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCustodyById = async (req, res) => {
  try {
    const custody = await Custody.findByPk(req.params.id, {
      include: [
        {
          model: Driver,
          as: 'driver',
          attributes: ['id', 'name', 'courierPhone', 'clientName', 'nationalId']
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'fullName', 'nationalId']
        },
        {
          model: CustodyItem,
          as: 'custodyItem'
        },
        {
          model: CustodyItem,
          as: 'replacementCustodyItem'
        }
      ]
    });

    if (!custody) return res.status(404).json({ message: 'Custody record not found' });
    return res.json(custody);
  } catch (error) {
    console.error('getCustodyById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateCustody = async (req, res) => {
  try {
    const custody = await Custody.findByPk(req.params.id);
    if (!custody) return res.status(404).json({ message: 'Custody record not found' });

    const {
      custodyType,
      custodyItemId,
      deliveryDate,
      status,
      returnDate,
      replacementDate,
      replacementCustodyType,
      replacementCustodyItemId,
      notes
    } = req.body;

    // Handle changing the base custody item ID
    if (custodyItemId !== undefined && custodyItemId !== custody.custodyItemId) {
      if (custody.custodyItemId) {
        const oldItem = await CustodyItem.findByPk(custody.custodyItemId);
        if (oldItem) {
          oldItem.status = 'available';
          await oldItem.save();
        }
      }
      if (custodyItemId) {
        const newItem = await CustodyItem.findByPk(custodyItemId);
        if (newItem) {
          newItem.status = 'assigned';
          await newItem.save();
          custody.custodyType = newItem.name;
        }
      }
      custody.custodyItemId = custodyItemId || null;
    } else if (custodyType !== undefined) {
      custody.custodyType = custodyType;
    }

    // Handle status transitions
    if (status !== undefined && status !== custody.status) {
      if (status === 'returned') {
        if (custody.custodyItemId) {
          const item = await CustodyItem.findByPk(custody.custodyItemId);
          if (item) {
            item.status = 'available';
            await item.save();
          }
        }
      } else if (status === 'replaced') {
        if (custody.custodyItemId) {
          const item = await CustodyItem.findByPk(custody.custodyItemId);
          if (item) {
            item.status = 'damaged';
            await item.save();
          }
        }
      } else if (status === 'delivered') {
        if (custody.custodyItemId) {
          const item = await CustodyItem.findByPk(custody.custodyItemId);
          if (item) {
            item.status = 'assigned';
            await item.save();
          }
        }
      }
      custody.status = status;
    }

    // Handle replacement item
    if (replacementCustodyItemId !== undefined && replacementCustodyItemId !== custody.replacementCustodyItemId) {
      if (custody.replacementCustodyItemId) {
        const oldRep = await CustodyItem.findByPk(custody.replacementCustodyItemId);
        if (oldRep) {
          oldRep.status = 'available';
          await oldRep.save();
        }
      }
      if (replacementCustodyItemId) {
        const newRep = await CustodyItem.findByPk(replacementCustodyItemId);
        if (newRep) {
          newRep.status = 'assigned';
          await newRep.save();
          custody.replacementCustodyType = newRep.name;
        }
      }
      custody.replacementCustodyItemId = replacementCustodyItemId || null;
    } else if (replacementCustodyType !== undefined) {
      custody.replacementCustodyType = replacementCustodyType;
    }

    if (deliveryDate !== undefined) custody.deliveryDate = deliveryDate;
    if (returnDate !== undefined) custody.returnDate = returnDate || null;
    if (replacementDate !== undefined) custody.replacementDate = replacementDate || null;
    if (notes !== undefined) custody.notes = notes;

    await custody.save();

    // Reload with associations
    const reloaded = await Custody.findByPk(custody.id, {
      include: [
        { model: Driver, as: 'driver', attributes: ['id', 'name', 'courierPhone', 'clientName', 'nationalId'] },
        { model: Employee, as: 'employee', attributes: ['id', 'fullName', 'nationalId'] },
        { model: CustodyItem, as: 'custodyItem' },
        { model: CustodyItem, as: 'replacementCustodyItem' }
      ]
    });

    return res.json(reloaded);
  } catch (error) {
    console.error('updateCustody error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteCustody = async (req, res) => {
  try {
    const custody = await Custody.findByPk(req.params.id);
    if (!custody) return res.status(404).json({ message: 'Custody record not found' });

    // Release items back to available
    if (custody.custodyItemId) {
      const item = await CustodyItem.findByPk(custody.custodyItemId);
      if (item) {
        item.status = 'available';
        await item.save();
      }
    }
    if (custody.replacementCustodyItemId) {
      const repItem = await CustodyItem.findByPk(custody.replacementCustodyItemId);
      if (repItem) {
        repItem.status = 'available';
        await repItem.save();
      }
    }

    await custody.destroy();
    return res.json({ message: 'Custody record deleted successfully' });
  } catch (error) {
    console.error('deleteCustody error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Simplified list of potential recipients (employees and drivers) for search auto-fill
exports.getRecipientsList = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: ['id', 'fullName', 'nationalId'],
      include: [
        {
          model: EmployeeEmployment,
          as: 'employment',
          attributes: ['department']
        }
      ]
    });

    const drivers = await Driver.findAll({
      attributes: ['id', 'name', 'clientName', 'courierPhone', 'nationalId']
    });

    const list = [
      ...employees.map(emp => ({
        id: emp.id,
        name: emp.fullName,
        type: 'employee',
        department: emp.employment ? emp.employment.department : 'N/A',
        company: null,
        phone: null,
        nationalId: emp.nationalId
      })),
      ...drivers.map(drv => ({
        id: drv.id,
        name: drv.name,
        type: 'driver',
        department: null,
        company: drv.clientName || 'No Partner assigned',
        phone: drv.courierPhone,
        nationalId: drv.nationalId
      }))
    ];

    return res.json(list);
  } catch (error) {
    console.error('getRecipientsList error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
