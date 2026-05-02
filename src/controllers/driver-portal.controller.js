const { Op } = require('sequelize');
const db = require('../models');

async function getInstallmentEligibility(driverId) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const installmentLoans = await db.DriverLoan.findAll({
        where: {
            driverId,
            installmentsCount: { [Op.gt]: 1 },
            status: { [Op.notIn]: ['rejected', 'cancelled'] },
            createdAt: { [Op.gte]: oneYearAgo }
        },
        order: [['createdAt', 'ASC']]
    });

    const hasPending = installmentLoans.some(l => l.status === 'pending');
    if (hasPending) {
        return {
            canRequest: false,
            remainingQuota: 0,
            nextAvailableDate: null,
            reason: 'pending_exists'
        };
    }

    const count = installmentLoans.length;

    if (count >= 2) {
        const oldestLoanDate = installmentLoans[0].decidedAt || installmentLoans[0].createdAt;
        const nextDate = new Date(oldestLoanDate);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        return {
            canRequest: false,
            remainingQuota: 0,
            nextAvailableDate: nextDate.toISOString(),
            reason: 'quota_exceeded'
        };
    }

    if (count === 1) {
        const firstLoanDate = installmentLoans[0].decidedAt || installmentLoans[0].createdAt;
        const nextDate = new Date(firstLoanDate);
        nextDate.setMonth(nextDate.getMonth() + 6);
        
        const now = new Date();
        if (now < nextDate) {
            return {
                canRequest: false,
                remainingQuota: 1,
                nextAvailableDate: nextDate.toISOString(),
                reason: 'cooldown_active'
            };
        } else {
            return {
                canRequest: true,
                remainingQuota: 1,
                nextAvailableDate: null,
                reason: null
            };
        }
    }

    return {
        canRequest: true,
        remainingQuota: 2,
        nextAvailableDate: null,
        reason: null
    };
}

exports.getProfile = async (req, res) => {
    try {
        const driver = req.driver;
        
        let clientData = null;
        let hubData = null;
        let zoneData = null;

        // Fetch Client and Account Manager
        if (driver.clientName) {
            clientData = await db.Client.findOne({
                where: { name: driver.clientName },
                include: [{ model: db.Auth, as: 'accountManagerUser' }]
            });
        }

        // Fetch Hub
        if (driver.hub) {
            hubData = await db.Hub.findOne({
                where: { name: driver.hub }
            });
        }

        // Fetch Zone (from area or residence)
        if (driver.area || driver.residence) {
            zoneData = await db.Zone.findOne({
                where: { name: driver.area || driver.residence }
            });
        }

        res.json({
            success: true,
            profile: {
                // Driver data
                id: driver.id,
                name: driver.name,
                courierPhone: driver.courierPhone,
                courierId: driver.courierId,
                vehicleType: driver.vehicleType,
                vehiclePlateNumber: driver.vehiclePlateNumber,
                nationalId: driver.nationalId,
                paymentMethod: driver.paymentMethod,
                bankName: driver.bankName,
                bankAccountNumber: driver.bankAccountNumber,
                walletName: driver.walletName,
                walletNumber: driver.walletNumber,
                
                // Client data
                client: clientData ? {
                    name: clientData.name,
                    accountManagerName: clientData.accountManagerUser?.fullName || clientData.accountManager || 'لا يوجد',
                    accountManagerPhone: clientData.accountManagerUser?.phone || 'لا يوجد',
                } : null,

                // Hub Data
                hub: hubData ? {
                    name: hubData.name,
                    address: hubData.address,
                    managerName: hubData.managerHubName,
                    managerPhone: hubData.managerHubPhone
                } : null,

                // Zone Data
                zone: zoneData ? {
                    name: zoneData.name,
                    area: zoneData.area
                } : null
            }
        });
    } catch (err) {
        console.error("getProfile Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getLoans = async (req, res) => {
    try {
        const loans = await db.DriverLoan.findAll({
            where: { driverId: req.driver.id },
            order: [['createdAt', 'DESC']]
        });
        
        const eligibility = await getInstallmentEligibility(req.driver.id);
        
        res.json({ success: true, loans, installmentEligibility: eligibility });
    } catch (err) {
        console.error("getLoans Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.createLoan = async (req, res) => {
    try {
        const { amount, installmentsCount, paymentMethod, bankName, bankAccountNumber, walletName, walletNumber, requestText } = req.body;
        
        if (!amount || !installmentsCount || !paymentMethod) {
            return res.status(400).json({ message: "يرجى ملء جميع البيانات المطلوبة (المبلغ، الأقساط، وسيلة الدفع)" });
        }
        
        if (installmentsCount > 1) {
            const eligibility = await getInstallmentEligibility(req.driver.id);
            if (!eligibility.canRequest) {
                return res.status(400).json({ 
                    message: "لا يمكنك طلب سلفة مقسطة في الوقت الحالي. يرجى مراجعة القواعد أو الانتظار حتى يحين موعد السلفة القادمة."
                });
            }
        }

        const loan = await db.DriverLoan.create({
            driverId: req.driver.id,
            amount,
            installmentsCount,
            paymentMethod,
            bankName,
            bankAccountNumber,
            walletName,
            walletNumber,
            requestText,
            ticketRequested: true,
            status: 'pending',
            clientNameSnapshot: req.driver.clientName,
            phoneNumberSnapshot: req.driver.courierPhone,
            hubSnapshot: req.driver.hub
        });

        res.json({ success: true, message: "تم تسجيل طلب السلفة بنجاح", loan });
    } catch (err) {
        console.error("createLoan Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.createFinancialRequest = async (req, res) => {
    try {
        const driver = req.driver;
        const { paymentMethod, bankName, bankAccountNumber, walletName, walletNumber } = req.body;

        if (!paymentMethod) {
            return res.status(400).json({ message: "paymentMethod is required" });
        }

        // Validate basic rules
        if (paymentMethod === 'bank' && (!bankName || !bankAccountNumber)) {
            return res.status(400).json({ message: "Bank Name and Account Number are required" });
        }
        if (paymentMethod === 'wallet' && (!walletName || !walletNumber)) {
            return res.status(400).json({ message: "Wallet Name and Number are required" });
        }
        
        // Find Account Manager
        let accountManagerId = null;
        if (driver.clientName) {
            const client = await db.Client.findOne({ where: { name: driver.clientName } });
            if (client && client.accountManagerId) {
                accountManagerId = client.accountManagerId;
            }
        }

        const request = await db.DriverFinancialRequest.create({
            driverId: driver.id,
            accountManagerId: accountManagerId,
            paymentMethod,
            bankName,
            bankAccountNumber,
            walletName,
            walletNumber,
            status: 'PENDING'
        });

        res.json({ success: true, message: "Request created successfully", request });
    } catch (err) {
        console.error("createFinancialRequest Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getFinancialRequestsHistory = async (req, res) => {
    try {
        const requests = await db.DriverFinancialRequest.findAll({
            where: { driverId: req.driver.id },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, requests });
    } catch (err) {
        console.error("getFinancialRequestsHistory Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getComplaints = async (req, res) => {
    try {
        const complaints = await db.DriverComplaint.findAll({
            where: { driverId: req.driver.id },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, complaints });
    } catch (err) {
        console.error("getComplaints Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.createComplaint = async (req, res) => {
    try {
        const { subject, text } = req.body;
        if (!subject || !text) {
            return res.status(400).json({ message: "البيانات ناقصة" });
        }
        
        const complaint = await db.DriverComplaint.create({
            driverId: req.driver.id,
            subject,
            text
        });

        res.json({ success: true, message: "تم إرسال شكواك بنجاح", complaint });
    } catch (err) {
        console.error("createComplaint Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getPayrollBreakdowns = async (req, res) => {
    try {
        const breakdowns = await db.Breakdown.findAll({
            order: [['year', 'DESC'], ['month', 'DESC']]
        });

        const myPayrolls = [];
        const myIdClean = String(req.driver.courierId).trim().replace(/\s+/g, '');

        for (const bk of breakdowns) {
            let bkEntries = bk.entries;
            if (typeof bkEntries === 'string') {
                try { bkEntries = JSON.parse(bkEntries); } catch(e) { bkEntries = []; }
            }

            if (Array.isArray(bkEntries)) {
                // Find driver in the JSON entries array with fuzzy matching
                const myEntry = bkEntries.find(e => {
                    const rowIdRaw = e["Courier ID Card No."] || e["idCard"] || e["ID"] || "";
                    const rowIdClean = String(rowIdRaw).trim().replace(/\s+/g, '');
                    return rowIdClean === myIdClean;
                });

                if (myEntry) {
                    myPayrolls.push({
                        id: bk.id,
                        month: bk.month,
                        year: bk.year,
                        isLocked: bk.isLocked,
                        data: myEntry
                    });
                }
            }
        }

        res.json({ success: true, payrolls: myPayrolls });
    } catch (err) {
        console.error("getPayrollBreakdowns Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await db.DriverNotification.findAll({
            where: { driverId: req.driver.id },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, notifications });
    } catch (err) {
        console.error("getNotifications Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await db.DriverNotification.findOne({
            where: { id, driverId: req.driver.id }
        });
        if (!notification) return res.status(404).json({ success: false, message: "Not found" });
        
        notification.isRead = true;
        await notification.save();
        res.json({ success: true });
    } catch (err) {
        console.error("markNotificationRead Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
