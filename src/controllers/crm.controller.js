// src/controllers/crm.controller.js
const { Op } = require("sequelize");
const { Interview, Auth, Client } = require("../models");

exports.getDay1Exceptions = async (req, res) => {
  try {
    const interviews = await Interview.findAll({
      where: {
        signedWithHr: 'Signed A Contract With HR',
        courierStatus: { [Op.notLike]: '%Active%' }, // Any except active
        securityResult: 'Negative',
        followUp1: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
        followUp2: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
        followUp3: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
      },
      include: [
        { model: Auth, as: 'accountManager', attributes: ['id', 'fullName'] },
        { model: Client, as: 'client', attributes: ['id', 'name'] }
      ],
      order: [['id', 'DESC']]
    });

    return res.json(interviews);
  } catch (error) {
    console.error("getDay1Exceptions error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.approveDay1Exception = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await Interview.findByPk(id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    interview.crmDay1Status = 'approved';
    interview.crmDay1ApprovedAt = new Date().toISOString().split('T')[0];
    
    await interview.save();

    return res.json({ message: "Exception approved successfully" });
  } catch (error) {
    console.error("approveDay1Exception error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.rejectDay1Exception = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await Interview.findByPk(id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    interview.crmDay1Status = 'rejected';
    
    await interview.save();

    return res.json({ message: "Exception rejected successfully" });
  } catch (error) {
    console.error("rejectDay1Exception error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
