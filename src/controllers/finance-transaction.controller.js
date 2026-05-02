const { FinanceTransaction, FinanceCategory, Auth, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getAllTransactions = async (req, res) => {
    try {
        const { startDate, endDate, categoryId, type, q } = req.query;
        const where = {};

        if (startDate && endDate) {
            where.transactionDate = { [Op.between]: [startDate, endDate] };
        } else if (startDate) {
            where.transactionDate = { [Op.gte]: startDate };
        } else if (endDate) {
            where.transactionDate = { [Op.lte]: endDate };
        }

        if (categoryId) where.categoryId = categoryId;

        const include = [
            {
                model: FinanceCategory,
                as: 'category',
                attributes: ['name', 'type'],
            },
            {
                model: Auth,
                as: 'createdBy',
                attributes: ['fullName'],
            }
        ];

        if (type) {
            include[0].where = { type };
        }

        if (q) {
            where.description = { [Op.like]: `%${q}%` };
        }

        const transactions = await FinanceTransaction.findAll({
            where,
            include,
            order: [['transactionDate', 'DESC'], ['id', 'DESC']],
        });

        return res.json(transactions);
    } catch (error) {
        console.error('getAllTransactions error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await FinanceTransaction.findByPk(id, {
            include: [
                { model: FinanceCategory, as: 'category' },
                { model: Auth, as: 'createdBy' }
            ]
        });
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        return res.json(transaction);
    } catch (error) {
        console.error('getTransactionById error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.createTransaction = async (req, res) => {
    try {
        const { categoryId, amount, transactionDate, description, referenceId, referenceType } = req.body;
        if (!categoryId || !amount || !transactionDate) {
            return res.status(400).json({ message: 'categoryId, amount, and transactionDate are required' });
        }

        const transaction = await FinanceTransaction.create({
            categoryId,
            amount,
            transactionDate,
            description,
            referenceId,
            referenceType,
            createdById: req.user?.id,
        });

        return res.status(201).json(transaction);
    } catch (error) {
        console.error('createTransaction error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { categoryId, amount, transactionDate, description } = req.body;

        const transaction = await FinanceTransaction.findByPk(id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        await transaction.update({
            categoryId,
            amount,
            transactionDate,
            description,
        });

        return res.json(transaction);
    } catch (error) {
        console.error('updateTransaction error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await FinanceTransaction.findByPk(id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        await transaction.destroy();
        return res.json({ message: 'Transaction deleted' });
    } catch (error) {
        console.error('deleteTransaction error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getFinanceSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const where = {};
        if (startDate && endDate) {
            where.transactionDate = { [Op.between]: [startDate, endDate] };
        }

        const summary = await FinanceTransaction.findAll({
            attributes: [
                [sequelize.col('category.type'), 'type'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
            ],
            include: [{
                model: FinanceCategory,
                as: 'category',
                attributes: []
            }],
            where,
            group: [sequelize.col('category.type')],
            raw: true
        });

        return res.json(summary);
    } catch (error) {
        console.error('getFinanceSummary error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
