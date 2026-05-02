const db = require('../models');

exports.listRequests = async (req, res) => {
    try {
        // If the logged-in user is an admin/super_admin or operation manager, they see all.
        // If they are an Account Manager (crm), they see requests where accountManagerId matches their ID.
        const userRole = req.user.role;
        const authUserId = req.user.id;

        const whereClause = {};
        if (userRole !== 'super_admin' && userRole !== 'admin' && userRole !== 'operation') {
            // CRM (Account Manager) or others
            whereClause.accountManagerId = authUserId;
        }

        const requests = await db.DriverFinancialRequest.findAll({
            where: whereClause,
            include: [
                { 
                    model: db.Driver, 
                    as: 'driver',
                    attributes: ['id', 'name', 'courierId', 'courierPhone', 'clientName']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(requests);
    } catch (err) {
        console.error("listRequests Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.decideRequest = async (req, res) => {
    const t = await db.sequelize.transaction();
    try {
        const requestId = req.params.id;
        const { status, rejectionReason } = req.body; // 'APPROVED' or 'REJECTED'

        const request = await db.DriverFinancialRequest.findByPk(requestId, { transaction: t });
        if (!request) {
            await t.rollback();
            return res.status(404).json({ message: "Request not found" });
        }

        if (request.status !== 'PENDING') {
            await t.rollback();
            return res.status(400).json({ message: "Request is already processed" });
        }

        // Must be authorized
        if (req.user.role !== 'super_admin' && req.user.role !== 'admin' && req.user.role !== 'operation' && request.accountManagerId !== req.user.id) {
            await t.rollback();
            return res.status(403).json({ message: "Not authorized to decide this request" });
        }

        request.status = status;
        request.reviewedBy = req.user.id;
        
        if (status === 'REJECTED') {
            request.rejectionReason = rejectionReason;
        } else if (status === 'APPROVED') {
            // Update the driver!
            const driver = await db.Driver.findByPk(request.driverId, { transaction: t });
            if (driver) {
                driver.paymentMethod = request.paymentMethod;
                driver.bankName = request.paymentMethod === 'bank' ? request.bankName : null;
                driver.bankAccountNumber = request.paymentMethod === 'bank' ? request.bankAccountNumber : null;
                driver.walletName = request.paymentMethod === 'wallet' ? request.walletName : null;
                driver.walletNumber = request.paymentMethod === 'wallet' ? request.walletNumber : null;
                await driver.save({ transaction: t });
            }
        }

        await request.save({ transaction: t });

        // System Automation: Notify Driver
        try {
            await db.DriverNotification.create({
                driverId: request.driverId,
                title: status === 'APPROVED' ? 'تحديث البيانات المالية (Financial Approved)' : 'رفض تحديث البيانات (Financial Rejected)',
                message: status === 'APPROVED' ? `تمت المراجعة والموافقة على تحديث بيانات الدفع الخاصة بك بنجاح.` : `اعتذرنا عن قبول طلب تحديث بياناتك المالية، الرجاء مراجعة الإدارة: ${rejectionReason || ''}`,
                type: 'popup',
                isRead: false
            }, { transaction: t });
        } catch (autoErr) {
            console.error("decideRequest automation error:", autoErr);
        }

        await t.commit();
        res.json({ success: true, message: "Request processed", request });

    } catch (err) {
        await t.rollback();
        console.error("decideRequest Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
