// src/controllers/business-module.controller.js
const { BusinessModule } = require("../models");

exports.getAllBusinessModules = async (req, res) => {
  try {
    const modules = await BusinessModule.findAll({ order: [['name', 'ASC']] });
    return res.json(modules);
  } catch (error) {
    console.error("getAllBusinessModules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.createBusinessModule = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const newModule = await BusinessModule.create({ name });
    return res.status(201).json(newModule);
  } catch (error) {
    console.error("createBusinessModule error:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: "Business module already exists" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateBusinessModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const module = await BusinessModule.findByPk(id);
    if (!module) return res.status(404).json({ message: "Business module not found" });

    if (name) module.name = name;
    await module.save();

    return res.json(module);
  } catch (error) {
    console.error("updateBusinessModule error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteBusinessModule = async (req, res) => {
  try {
    const { id } = req.params;
    const module = await BusinessModule.findByPk(id);
    if (!module) return res.status(404).json({ message: "Business module not found" });

    await module.destroy();
    return res.json({ message: "Business module deleted successfully" });
  } catch (error) {
    console.error("deleteBusinessModule error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
