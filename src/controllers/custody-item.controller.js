const { CustodyItem, Custody } = require('../models');

exports.getAllCustodyItems = async (req, res) => {
  try {
    const items = await CustodyItem.findAll({
      include: [
        {
          model: Custody,
          as: 'assignments',
          attributes: ['id', 'status']
        }
      ],
      order: [['id', 'DESC']]
    });

    const results = items.map(item => {
      const activeAssignments = item.assignments ? item.assignments.filter(a => a.status === 'delivered').length : 0;
      const availableQty = Math.max(0, item.totalQty - activeAssignments);
      
      let currentStatus = item.status;
      if (item.status === 'available' || item.status === 'assigned') {
        currentStatus = availableQty > 0 ? 'available' : 'assigned';
      }

      return {
        id: item.id,
        name: item.name,
        serialNumber: item.serialNumber,
        status: currentStatus,
        totalQty: item.totalQty,
        availableQty: availableQty,
        assignedQty: activeAssignments,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    });

    return res.json(results);
  } catch (error) {
    console.error('getAllCustodyItems error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCustodyItemById = async (req, res) => {
  try {
    const item = await CustodyItem.findByPk(req.params.id, {
      include: [
        {
          model: Custody,
          as: 'assignments',
          attributes: ['id', 'status']
        }
      ]
    });
    if (!item) return res.status(404).json({ message: 'Custody item not found' });
    
    const activeAssignments = item.assignments ? item.assignments.filter(a => a.status === 'delivered').length : 0;
    const availableQty = Math.max(0, item.totalQty - activeAssignments);
    let currentStatus = item.status;
    if (item.status === 'available' || item.status === 'assigned') {
      currentStatus = availableQty > 0 ? 'available' : 'assigned';
    }

    return res.json({
      id: item.id,
      name: item.name,
      serialNumber: item.serialNumber,
      status: currentStatus,
      totalQty: item.totalQty,
      availableQty: availableQty,
      assignedQty: activeAssignments,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  } catch (error) {
    console.error('getCustodyItemById error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createCustodyItem = async (req, res) => {
  try {
    const { name, serialNumber, status, totalQty, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const item = await CustodyItem.create({
      name,
      serialNumber,
      status: status || 'available',
      totalQty: totalQty !== undefined ? parseInt(totalQty) : 1,
      notes
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error('createCustodyItem error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateCustodyItem = async (req, res) => {
  try {
    const item = await CustodyItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Custody item not found' });

    const { name, serialNumber, status, totalQty, notes } = req.body;
    if (name !== undefined) item.name = name;
    if (serialNumber !== undefined) item.serialNumber = serialNumber || null;
    if (status !== undefined) item.status = status;
    if (totalQty !== undefined) item.totalQty = parseInt(totalQty);
    if (notes !== undefined) item.notes = notes || null;

    await item.save();
    return res.json(item);
  } catch (error) {
    console.error('updateCustodyItem error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteCustodyItem = async (req, res) => {
  try {
    const item = await CustodyItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Custody item not found' });

    await item.destroy();
    return res.json({ message: 'Custody item deleted successfully' });
  } catch (error) {
    console.error('deleteCustodyItem error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
