// src/controllers/client-module.controller.js
const { ClientModule, Client } = require("../models");

exports.create = async (req, res) => {
  try {
    const { clientId, columnName, systemAlias, valueType, operationType, isPricingParameter, pricingRule, linkedColumns } = req.body;
    
    // Check if client exists
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const module = await ClientModule.create({
      clientId,
      columnName,
      systemAlias: systemAlias || 'CUSTOM',
      valueType: valueType || 'amount',
      operationType: operationType || 'none',
      isPricingParameter: isPricingParameter || false,
      pricingRule: pricingRule || 'none',
      linkedColumns: linkedColumns || null,
    });

    res.status(201).json(module);
  } catch (error) {
    console.error("Error creating client module:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.bulkCreate = async (req, res) => {
  try {
    const { modules } = req.body;
    
    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ message: "Invalid or empty modules array" });
    }

    // Optional: verify the client exists using the first module's clientId
    const clientId = modules[0].clientId;
    if (clientId) {
      const client = await Client.findByPk(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
    }

    const createdModules = await ClientModule.bulkCreate(modules);

    res.status(201).json({
      message: "Modules created successfully",
      data: createdModules
    });
  } catch (error) {
    console.error("Error bulk creating client modules:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.bulkReplace = async (req, res) => {
  try {
    const { clientId, modules } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Delete existing
    await ClientModule.destroy({ where: { clientId } });

    // Create new
    let createdModules = [];
    if (modules && Array.isArray(modules) && modules.length > 0) {
      createdModules = await ClientModule.bulkCreate(modules);
    }

    res.status(200).json({
      message: "Modules replaced successfully",
      data: createdModules
    });
  } catch (error) {
    console.error("Error bulk replacing client modules:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const modules = await ClientModule.findAll({
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(modules);
  } catch (error) {
    console.error("Error fetching client modules:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const module = await ClientModule.findByPk(req.params.id, {
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "name"],
        },
      ],
    });
    if (!module) return res.status(404).json({ message: "Not found" });
    res.status(200).json(module);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const module = await ClientModule.findByPk(req.params.id);
    if (!module) return res.status(404).json({ message: "Not found" });

    await module.update(req.body);
    res.status(200).json(module);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const module = await ClientModule.findByPk(req.params.id);
    if (!module) return res.status(404).json({ message: "Not found" });

    await module.destroy();
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Find by Client ID
exports.findByClient = async (req, res) => {
  try {
    const modules = await ClientModule.findAll({
      where: { clientId: req.params.clientId },
    });
    res.status(200).json(modules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
