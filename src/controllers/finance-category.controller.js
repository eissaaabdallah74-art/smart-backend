const { FinanceCategory } = require('../models');
const { Op } = require('sequelize');

exports.getAllCategories = async (req, res) => {
    try {
        const { type, q } = req.query;
        const where = {};
        if (type) where.type = type;
        if (q) {
            where.name = { [Op.like]: `%${q}%` };
        }

        const categories = await FinanceCategory.findAll({
            where,
            order: [['name', 'ASC']],
        });
        return res.json(categories);
    } catch (error) {
        console.error('getAllCategories error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await FinanceCategory.findByPk(id);
        if (!category) return res.status(404).json({ message: 'Category not found' });
        return res.json(category);
    } catch (error) {
        console.error('getCategoryById error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, type, description } = req.body;
        if (!name || !type) {
            return res.status(400).json({ message: 'Name and type are required' });
        }

        const category = await FinanceCategory.create({
            name,
            type,
            description,
        });
        return res.status(201).json(category);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Category name already exists' });
        }
        console.error('createCategory error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, description } = req.body;

        const category = await FinanceCategory.findByPk(id);
        if (!category) return res.status(404).json({ message: 'Category not found' });

        await category.update({
            name,
            type,
            description,
        });
        return res.json(category);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Category name already exists' });
        }
        console.error('updateCategory error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await FinanceCategory.findByPk(id);
        if (!category) return res.status(404).json({ message: 'Category not found' });

        // TODO: Check if category is used in transactions before deleting
        await category.destroy();
        return res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error('deleteCategory error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
