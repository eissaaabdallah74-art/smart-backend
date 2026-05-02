const { SystemAlias } = require('../models');

exports.findAll = async (req, res) => {
  try {
    const aliases = await SystemAlias.findAll({
      order: [['isCore', 'DESC'], ['name', 'ASC']]
    });
    res.json(aliases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, code, description, isCore } = req.body;
    
    // Ensure code is unique
    const existing = await SystemAlias.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ message: 'Code already exists' });
    }

    const alias = await SystemAlias.create({
      name,
      code: code.toUpperCase().replace(/\s+/g, '_'),
      description,
      isCore: isCore || false
    });

    res.status(201).json(alias);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const alias = await SystemAlias.findByPk(id);
    if (!alias) {
      return res.status(404).json({ message: 'System Alias not found' });
    }

    // Don't allow changing the code of core aliases
    if (alias.isCore && code && code !== alias.code) {
      return res.status(403).json({ message: 'Cannot modify code of core aliases' });
    }

    await alias.update({
      name: name || alias.name,
      code: alias.isCore ? alias.code : (code ? code.toUpperCase().replace(/\s+/g, '_') : alias.code),
      description: description !== undefined ? description : alias.description
    });

    res.json(alias);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const alias = await SystemAlias.findByPk(id);
    if (!alias) {
      return res.status(404).json({ message: 'System Alias not found' });
    }

    if (alias.isCore) {
      return res.status(403).json({ message: 'Core aliases cannot be deleted' });
    }

    await alias.destroy();
    res.json({ message: 'System Alias deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
