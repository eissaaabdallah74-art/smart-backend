const { Driver, DriverAttendance, Payroll, Vendor, Client, Hub, Zone, AuditLog } = require('../../../models');
const { Op, fn, col } = require('sequelize');
const AIDataRedactor = require('../ai-data-redactor.service');

/**
 * AI Tools for Courier/Driver data
 */
const courierTools = {
    async getCourier360Profile(courierId, user) {
        if (!courierId) return { error: 'Courier ID is required' };
        
        try {
            const courier = await Driver.findByPk(courierId, {
                include: [
                    { model: Vendor, as: 'vendor', attributes: ['id', 'name'] }
                ]
            });
            if (!courier) return { message: 'Courier not found' };

            // Fetch recent attendance summary (last 30 days)
            const attendance = await DriverAttendance.findAll({
                where: { driverId: courierId },
                limit: 30,
                order: [['date', 'DESC']]
            });

            // Fetch recent payroll
            const payrolls = await Payroll.findAll({
                where: { driverId: courierId },
                limit: 3,
                order: [['year', 'DESC'], ['month', 'DESC']]
            });

            const redacted = AIDataRedactor.redactCourier(courier);
            
            return {
                ...redacted,
                vendorName: courier.vendor?.name || 'N/A',
                attendanceSummary: {
                    totalPresent: attendance.filter(a => a.status === 'present').length,
                    totalAbsent: attendance.filter(a => a.status === 'absent').length,
                    recentStatus: attendance[0]?.status || 'N/A'
                },
                payrollHistory: payrolls.map(p => ({
                    period: `${p.month}/${p.year}`,
                    netSalary: AIDataRedactor.maskFinancial(p.netSalary),
                    status: p.status
                }))
            };
        } catch (e) {
            console.error('[AI Tool Error] getCourier360Profile:', e);
            return { error: 'Failed to fetch 360 profile', details: e.message };
        }
    },

    async getCourierByNationalId(nationalId, user) {
        if (!nationalId) return { error: 'National ID is required' };
        
        try {
            const courier = await Driver.findOne({
                where: { nationalId: nationalId },
                include: [
                    { model: Vendor, as: 'vendor', attributes: ['id', 'name'] }
                ]
            });

            if (!courier) return { message: 'Courier not found with this national ID' };

            // Fetch recent attendance summary (last 30 days)
            const attendance = await DriverAttendance.findAll({
                where: { driverId: courier.id },
                limit: 30,
                order: [['date', 'DESC']]
            });

            // Fetch recent payroll
            const payrolls = await Payroll.findAll({
                where: { driverId: courier.id },
                limit: 3,
                order: [['year', 'DESC'], ['month', 'DESC']]
            });

            const redacted = AIDataRedactor.redactCourier(courier);
            
            return {
                ...redacted,
                vendorName: courier.vendor?.name || 'N/A',
                attendanceSummary: {
                    totalPresent: attendance.filter(a => a.status === 'present').length,
                    totalAbsent: attendance.filter(a => a.status === 'absent').length,
                    recentStatus: attendance[0]?.status || 'N/A'
                },
                payrollHistory: payrolls.map(p => ({
                    period: `${p.month}/${p.year}`,
                    netSalary: AIDataRedactor.maskFinancial(p.netSalary),
                    status: p.status
                }))
            };
        } catch (e) {
            console.error('[AI Tool Error] getCourierByNationalId:', e);
            return { error: 'Failed to fetch courier by national ID', details: e.message };
        }
    },

    async searchCouriers(filters, user) {
        const { q, status, activeOnly, limit = 20 } = filters;
        const where = {};
        
        if (q) {
            where[Op.or] = [
                { name: { [Op.like]: `%${q}%` } },
                { courierCode: { [Op.like]: `%${q}%` } },
                { nationalId: { [Op.like]: `%${q}%` } },
                { courierPhone: { [Op.like]: `%${q}%` } }
            ];
        }

        if (status) where.contractStatus = status;
        if (activeOnly) where.contractStatus = 'active';

        try {
            const safeAttributes = this._getExistingAttributes(Driver, ['id', 'name', 'courierCode', 'clientName', 'hub', 'contractStatus', 'vehicleType']);
            
            const { count, rows } = await Driver.findAndCountAll({
                where,
                limit: Math.min(limit, process.env.AI_MAX_RESULT_LIMIT || 50),
                attributes: safeAttributes
            });

            return {
                total: count,
                results: AIDataRedactor.redactList(rows, (d) => ({
                    id: d.id,
                    name: d.name,
                    code: d.courierCode,
                    client: d.clientName,
                    hub: d.hub,
                    status: d.contractStatus,
                    vehicle: d.vehicleType
                }))
            };
        } catch (e) {
            return { message: 'Search failed', details: e.message };
        }
    },

    _getExistingAttributes(model, requestedFields) {
        if (!model?.rawAttributes || !requestedFields) return requestedFields;
        const attrs = model.rawAttributes;
        return requestedFields.filter(field => attrs[field]);
    },

    async getCourierAttendanceSummary(courierId, monthYear, user) {
        if (!courierId) return { message: 'Courier ID is required' };
        
        try {
            let where = { driverId: courierId };
            if (monthYear) {
                // monthYear format: "2026-05"
                where.date = { [Op.like]: `${monthYear}%` };
            }

            const stats = await DriverAttendance.findAll({
                where,
                attributes: [
                    'status',
                    [fn('COUNT', col('status')), 'count']
                ],
                group: ['status']
            });

            return {
                courierId,
                period: monthYear || 'All Time',
                summary: stats.map(s => ({
                    status: s.status,
                    count: s.get('count')
                }))
            };
        } catch (e) {
            return { error: 'Attendance fetch failed', details: e.message };
        }
    },

    async getCourierPayrollHistory(courierId, user) {
        if (!courierId) return { error: 'Courier ID is required' };
        try {
            const payrolls = await Payroll.findAll({
                where: { driverId: courierId },
                limit: 3,
                order: [['year', 'DESC'], ['month', 'DESC']]
            });
            return payrolls.map(p => ({
                period: `${p.month}/${p.year}`,
                basicSalary: AIDataRedactor.maskFinancial(p.basicSalary),
                netSalary: AIDataRedactor.maskFinancial(p.netSalary),
                status: p.status,
                paymentDate: p.paymentDate
            }));
        } catch (e) {
            return { error: 'Payroll fetch failed', details: e.message };
        }
    }
};

module.exports = courierTools;
