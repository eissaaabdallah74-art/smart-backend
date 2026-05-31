const { Client, ClientContract, Driver, Payroll, FinanceTransaction } = require('../../../models');
const { Op, fn, col } = require('sequelize');

/**
 * AI Tools for Company/Client data
 */
const companyTools = {
    async getCompanyOverview(companyId, user) {
        try {
            if (companyId) {
                const client = await Client.findByPk(companyId, {
                    include: [{ model: ClientContract, as: 'contracts' }]
                });
                if (!client) return { message: 'Company not found' };

                // Count drivers assigned to this client
                const driversCount = await Driver.count({
                    where: { 
                        [Op.or]: [
                            { clientName: client.name },
                            { clientName: { [Op.like]: `%${client.name}%` } }
                        ],
                        contractStatus: 'active'
                    }
                });

                return {
                    id: client.id,
                    name: client.name,
                    email: client.contactEmail,
                    isActive: client.isActive,
                    activeDriversCount: driversCount,
                    contracts: (client.contracts || []).map(c => ({
                        id: c.id,
                        status: c.status,
                        startDate: c.startDate,
                        endDate: c.endDate
                    }))
                };
            } else {
                const clients = await Client.findAll({
                    attributes: ['id', 'name', 'isActive'],
                    limit: 20
                });
                return clients;
            }
        } catch (e) {
            console.error('[AI Tool Error] getCompanyOverview:', e);
            return { error: 'Data source error', details: e.message };
        }
    },

    async getCompanyBillingSummary(companyId, month, user) {
        if (!companyId) return { message: 'Company ID is required' };
        try {
            const client = await Client.findByPk(companyId);
            if (!client) return { message: 'Company not found' };

            // Fetch payrolls related to this client (indirectly via drivers)
            // This is complex in this schema, so we'll look for FinanceTransactions 
            // if they are tagged with client_id
            const transactions = await FinanceTransaction.findAll({
                where: { 
                    client_id: companyId,
                    type: 'income' // Assuming billing is income
                },
                limit: 5,
                order: [['createdAt', 'DESC']]
            });

            return {
                companyName: client.name,
                recentBilling: transactions.map(t => ({
                    date: t.createdAt,
                    amount: t.amount,
                    description: t.description
                }))
            };
        } catch (e) {
            return { error: 'Billing data fetch failed', details: e.message };
        }
    }
};

module.exports = companyTools;
