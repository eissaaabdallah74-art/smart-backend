const { Breakdown, DriverLoan, Driver, DriverNotification } = require('../models');

exports.saveBreakdown = async (req, res) => {
    try {
        const { clientId, month, year, entries } = req.body;
        if (!clientId || !month || !year || !entries) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const existingBreakdown = await Breakdown.findOne({ where: { clientId, month, year } });
        
        if (existingBreakdown && existingBreakdown.isLocked) {
            return res.status(403).json({ message: 'This breakdown has been locked and invoiced by Finance. It cannot be modified.' });
        }
        
        let oldDeductions = {};
        if (existingBreakdown && existingBreakdown.entries) {
            let oldEntries = typeof existingBreakdown.entries === 'string' ? JSON.parse(existingBreakdown.entries) : existingBreakdown.entries;
            for (const entry of oldEntries) {
                if (entry.appliedLoanId && entry.loanDeduction) {
                    oldDeductions[entry.appliedLoanId] = (oldDeductions[entry.appliedLoanId] || 0) + Number(entry.loanDeduction);
                }
            }
        }

        let newDeductions = {};
        let parsedEntries = typeof entries === 'string' ? JSON.parse(entries) : entries;
        for (const entry of parsedEntries) {
            if (entry.appliedLoanId && entry.loanDeduction) {
                newDeductions[entry.appliedLoanId] = (newDeductions[entry.appliedLoanId] || 0) + Number(entry.loanDeduction);
            }
        }

        // Calculate deltas and update loans
        const allLoanIds = new Set([...Object.keys(oldDeductions), ...Object.keys(newDeductions)]);
        
        for (const loanIdStr of allLoanIds) {
            const loanId = Number(loanIdStr);
            const oldVal = oldDeductions[loanId] || 0;
            const newVal = newDeductions[loanId] || 0;
            const delta = newVal - oldVal;

            if (delta !== 0) {
                const loan = await DriverLoan.findByPk(loanId);
                if (loan) {
                    const currentPaid = Number(loan.paidAmount) || 0;
                    const newPaid = currentPaid + delta;
                    
                    loan.paidAmount = newPaid < 0 ? 0 : newPaid;
                    
                    if (Number(loan.paidAmount) >= Number(loan.amount) && loan.status !== 'closed') {
                       loan.status = 'closed';
                    } else if (Number(loan.paidAmount) < Number(loan.amount) && loan.status === 'closed') {
                       loan.status = 'approved'; // Reopen if it was closed
                    }
                    
                    await loan.save();
                }
            }
        }

        // Use upsert to handle create or update
        const [breakdown, created] = await Breakdown.upsert({
            clientId,
            month,
            year,
            entries
        });

        return res.status(created ? 201 : 200).json(breakdown);
    } catch (error) {
        console.error('saveBreakdown error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getBreakdowns = async (req, res) => {
    try {
        const { clientId, month, year } = req.query;
        const where = {};
        if (clientId) where.clientId = clientId;
        if (month) where.month = month;
        if (year) where.year = year;

        const breakdowns = await Breakdown.findAll({
            where,
            order: [['year', 'DESC'], ['month', 'DESC']]
        });

        return res.json(breakdowns);
    } catch (error) {
        console.error('getBreakdowns error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.lockBreakdown = async (req, res) => {
    try {
        const { clientId, month, year } = req.body;
        if (!clientId || !month || !year) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const breakdown = await Breakdown.findOne({ where: { clientId, month, year } });
        if (!breakdown) {
            return res.status(404).json({ message: 'Breakdown not found' });
        }

        breakdown.isLocked = true;
        await breakdown.save();

        // System Automation: Notify Drivers of Payroll
        try {
            const entries = typeof breakdown.entries === 'string' ? JSON.parse(breakdown.entries) : breakdown.entries;
            const nationalIds = [];
            for (const row of (entries || [])) {
                if (row['Courier ID Card No.']) {
                    nationalIds.push(String(row['Courier ID Card No.']));
                }
            }
            if (nationalIds.length > 0) {
                // Find all drivers by national ID
                const drivers = await Driver.findAll({
                    where: { courierId: nationalIds }
                });
                
                const notifications = drivers.map(d => ({
                    driverId: d.id,
                    title: 'إشعار المرتب (Payroll)',
                    message: `تم اعتماد وإصدار مرتبك لشهر ${month}/${year}. لمزيد من التفاصيل يرجى مراجعة صفحة المرتبات.`,
                    type: 'normal',
                    isRead: false
                }));

                if (notifications.length > 0) {
                    await DriverNotification.bulkCreate(notifications);
                }
            }
        } catch (autoErr) {
            console.error('lockBreakdown automation error:', autoErr);
        }

        return res.json({ message: 'Breakdown locked successfully', breakdown });
    } catch (error) {
        console.error('lockBreakdown error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
