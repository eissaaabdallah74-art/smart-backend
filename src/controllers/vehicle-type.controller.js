// src/controllers/vehicle-type.controller.js
const { VehicleType } = require("../models");

exports.getAllVehicleTypes = async (req, res) => {
  try {
    const types = await VehicleType.findAll({ order: [['name', 'ASC']] });
    return res.json(types);
  } catch (error) {
    console.error("getAllVehicleTypes error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.createVehicleType = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const newType = await VehicleType.create({ name });
    return res.status(201).json(newType);
  } catch (error) {
    console.error("createVehicleType error:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: "Vehicle type already exists" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateVehicleType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const type = await VehicleType.findByPk(id);
    if (!type) return res.status(404).json({ message: "Vehicle type not found" });

    if (name) type.name = name;
    await type.save();

    return res.json(type);
  } catch (error) {
    console.error("updateVehicleType error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteVehicleType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await VehicleType.findByPk(id);
    if (!type) return res.status(404).json({ message: "Vehicle type not found" });

    await type.destroy();
    return res.json({ message: "Vehicle type deleted successfully" });
  } catch (error) {
    console.error("deleteVehicleType error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
