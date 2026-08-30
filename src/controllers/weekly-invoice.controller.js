const { WeeklyInvoice, Breakdown } = require('../models');

exports.saveWeeklyInvoice = async (req, res) => {
    try {
        const { clientId, month, year, weekIndex, hubName, entries } = req.body;
        if (!clientId || !month || !year || weekIndex === undefined || !entries) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const existing = await WeeklyInvoice.findOne({
            where: { clientId, month, year, weekIndex, hubName: hubName || null }
        });

        if (existing && existing.status === 'approved_by_finance') {
            return res.status(403).json({ message: 'This weekly invoice has already been approved by Finance and cannot be modified.' });
        }

        if (existing) {
            existing.entries = entries;
            existing.status = 'pending_crm';
            existing.disputeReason = null;
            existing.rejectionReason = null;
            await existing.save();
            return res.json(existing);
        } else {
            const invoice = await WeeklyInvoice.create({
                clientId,
                month,
                year,
                weekIndex,
                hubName: hubName || null,
                entries,
                status: 'pending_crm',
                createdBy: req.user ? req.user.id : null
            });
            return res.status(201).json(invoice);
        }
    } catch (error) {
        console.error('saveWeeklyInvoice error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getWeeklyInvoices = async (req, res) => {
    try {
        const { clientId, month, year } = req.query;
        const where = {};
        if (clientId) where.clientId = clientId;
        if (month) where.month = month;
        if (year) where.year = year;

        const invoices = await WeeklyInvoice.findAll({
            where,
            order: [['weekIndex', 'ASC'], ['hubName', 'ASC']]
        });

        return res.json(invoices);
    } catch (error) {
        console.error('getWeeklyInvoices error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateWeeklyStatus = async (req, res) => {
    try {
        const { id, status, disputeReason, rejectionReason } = req.body;
        if (!id || !status) {
            return res.status(400).json({ message: 'Missing required id or status' });
        }

        const invoice = await WeeklyInvoice.findByPk(id);
        if (!invoice) {
            return res.status(404).json({ message: 'Weekly invoice not found' });
        }

        invoice.status = status;
        if (disputeReason !== undefined) invoice.disputeReason = disputeReason;
        if (rejectionReason !== undefined) invoice.rejectionReason = rejectionReason;

        await invoice.save();
        return res.json({ message: 'Status updated successfully', invoice });
    } catch (error) {
        console.error('updateWeeklyStatus error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.consolidateMonthlyBreakdown = async (req, res) => {
    try {
        const { clientId, month, year } = req.body;
        if (!clientId || !month || !year) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Fetch all approved weekly invoices for this client/month/year
        const approvedInvoices = await WeeklyInvoice.findAll({
            where: {
                clientId,
                month,
                year,
                status: 'approved_by_finance'
            }
        });

        if (approvedInvoices.length === 0) {
            return res.status(400).json({ message: 'No approved weekly invoices found for this month to consolidate.' });
        }

        // Consolidate entries by courier
        const consolidatedMap = new Map();

        for (const inv of approvedInvoices) {
            const entries = typeof inv.entries === 'string' ? JSON.parse(inv.entries) : inv.entries;
            for (const row of (entries || [])) {
                // Key by national ID, courier ID, or name
                const idCard = row._normalizedIdCard || row['Courier ID Card No.'] || row['ID Card'] || row['National ID'];
                const name = row._normalizedDriverName || row['Courier Name'] || row['Name'];
                const courierKey = idCard ? String(idCard).trim() : (name ? String(name).trim().toLowerCase() : 'unknown');

                if (!consolidatedMap.has(courierKey)) {
                    consolidatedMap.set(courierKey, {
                        ...row,
                        _normalizedIdCard: idCard,
                        _normalizedDriverName: name,
                        totalOrders: 0,
                        baseSalary: 0,
                        smartCommission: 0,
                        loanDeduction: 0,
                        shortage: 0,
                        losses: 0,
                        totalOverall: 0
                    });
                }

                const existingRow = consolidatedMap.get(courierKey);

                // Accumulate numeric values
                existingRow.totalOrders += (parseFloat(row['Total Orders'] || row.totalOrders) || 0);
                existingRow.baseSalary += (parseFloat(row['Base Salary "Total"'] || row.baseSalary || row.grossBaseSalary) || 0);
                existingRow.smartCommission += (parseFloat(row['Smart Commission'] || row.smartCommission) || 0);
                existingRow.loanDeduction += (parseFloat(row['Loan Deduction'] || row.loanDeduction) || 0);
                existingRow.shortage += (parseFloat(row['Shortage'] || row.shortage) || 0);
                existingRow.losses += (parseFloat(row['Losses'] || row.losses) || 0);
            }
        }

        const consolidatedEntries = Array.from(consolidatedMap.values()).map(r => ({
            ...r,
            baseSalary: Number(r.baseSalary.toFixed(2)),
            smartCommission: Number(r.smartCommission.toFixed(2)),
            loanDeduction: Number(r.loanDeduction.toFixed(2)),
            shortage: Number(r.shortage.toFixed(2)),
            losses: Number(r.losses.toFixed(2)),
            _finalNetPayout: Number((r.baseSalary - r.loanDeduction - r.shortage - r.losses).toFixed(2)),
            totalOverall: Number((r.baseSalary + r.smartCommission).toFixed(2))
        }));

        // Upsert into Breakdown model
        const [breakdown, created] = await Breakdown.upsert({
            clientId,
            month,
            year,
            entries: consolidatedEntries,
            status: 'pending_am',
            isLocked: false
        });

        return res.json({
            message: 'Monthly breakdown consolidated successfully from approved weekly invoices',
            breakdown,
            consolidatedCount: consolidatedEntries.length
        });
    } catch (error) {
        console.error('consolidateMonthlyBreakdown error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
