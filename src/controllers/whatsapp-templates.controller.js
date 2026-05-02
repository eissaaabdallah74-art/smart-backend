const db = require("../models");
const WhatsappTemplateGroup = db.WhatsappTemplateGroup;
const WhatsappTemplate = db.WhatsappTemplate;

// ===================== GROUPS =====================

exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const group = await WhatsappTemplateGroup.create({ name });
    return res.status(201).json(group);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create group", error: error.message });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const groups = await WhatsappTemplateGroup.findAll({
      include: [{ model: WhatsappTemplate, as: 'templates' }],
      order: [['createdAt', 'DESC']]
    });
    return res.json(groups);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch groups", error: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const group = await WhatsappTemplateGroup.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    group.name = req.body.name || group.name;
    await group.save();
    return res.json(group);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update group", error: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const group = await WhatsappTemplateGroup.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    await group.destroy();
    return res.json({ message: "Group deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete group", error: error.message });
  }
};


// ===================== TEMPLATES =====================

exports.createTemplate = async (req, res) => {
  try {
    const { groupId, content } = req.body;
    const template = await WhatsappTemplate.create({ groupId, content });
    return res.status(201).json(template);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create template", error: error.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const template = await WhatsappTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    template.content = req.body.content || template.content;
    await template.save();
    return res.json(template);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update template", error: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const template = await WhatsappTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    await template.destroy();
    return res.json({ message: "Template deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete template", error: error.message });
  }
};
