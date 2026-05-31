const { Driver, Client, FinanceTransaction, Payroll } = require('../../../models');
const { Op, fn, col } = require('sequelize');

/**
 * AI Tools for Operations and Finance Reports
 */
const reportsTools = {
    async generateOperationsReport(filters, user) {
        try {
            // Stats by status
            const statusStats = await Driver.findAll({
                attributes: [
                    'contractStatus',
                    [fn('COUNT', col('id')), 'count']
                ],
                group: ['contractStatus']
            });

            // Stats by vehicle type
            const vehicleStats = await Driver.findAll({
                attributes: [
                    'vehicleType',
                    [fn('COUNT', col('id')), 'count']
                ],
                where: { contractStatus: 'active' },
                group: ['vehicleType']
            });

            // Stats by client (top 5)
            const clientStats = await Driver.findAll({
                attributes: [
                    'clientName',
                    [fn('COUNT', col('id')), 'count']
                ],
                where: { contractStatus: 'active' },
                group: ['clientName'],
                order: [[fn('COUNT', col('id')), 'DESC']],
                limit: 5
            });

            return {
                timestamp: new Date(),
                overall: statusStats.map(s => ({
                    status: s.contractStatus || 'Unknown',
                    count: s.get('count')
                })),
                activeVehicles: vehicleStats.map(v => ({
                    type: v.vehicleType || 'N/A',
                    count: v.get('count')
                })),
                topClients: clientStats.map(c => ({
                    client: c.clientName || 'Unassigned',
                    count: c.get('count')
                }))
            };
        } catch (e) {
            console.error('[AI Tool Error] generateOperationsReport:', e);
            return { error: 'Report generation failed', details: e.message };
        }
    },

    async generateFinanceReport(filters, user) {
        try {
            // Summary for current month (or filtered)
            const now = new Date();
            const month = filters?.month || (now.getMonth() + 1);
            const year = filters?.year || now.getFullYear();

            // Total Payroll for the month
            const totalPayroll = await Payroll.sum('netSalary', {
                where: { month, year }
            });

            // Total Income/Expense from Transactions
            const income = await FinanceTransaction.sum('amount', {
                where: { 
                    type: 'income',
                    createdAt: { [Op.gte]: new Date(year, month - 1, 1) }
                }
            });

            const expense = await FinanceTransaction.sum('amount', {
                where: { 
                    type: 'expense',
                    createdAt: { [Op.gte]: new Date(year, month - 1, 1) }
                }
            });

            return {
                period: `${month}/${year}`,
                metrics: {
                    totalPayroll: totalPayroll || 0,
                    totalIncome: income || 0,
                    totalExpense: expense || 0,
                    netCashflow: (income || 0) - (expense || 0) - (totalPayroll || 0)
                },
                disclaimer: "هذا التقرير المالي مبني على البيانات المتاحة فقط ولا يمثل ربحية تعاقدية نهائية.",
                dataSource: 'Sequelize (FinanceTransaction + Payroll models)'
            };
        } catch (e) {
            return { error: 'Finance report failed', details: e.message };
        }
    }
};

module.exports = reportsTools;
