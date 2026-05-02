const db = require('../models');

exports.blastNotifications = async (req, res) => {
    try {
        const { title, message, type, filters } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'العنوان والرسالة مطلوبان' });
        }

        // Build driver where clause based on filters
        const whereClause = { hiringStatus: 'Active' }; // Usually only target Active drivers
        
        if (filters) {
             if (filters.clientId) {
                  const client = await db.Client.findByPk(filters.clientId);
                  if (client) whereClause.clientName = client.name;
             }
             if (filters.hub) whereClause.hub = filters.hub;
             if (filters.zone) whereClause.area = filters.zone;
             if (filters.vehicleType) whereClause.vehicleType = filters.vehicleType;
             if (filters.driverId) whereClause.id = filters.driverId;
        }

        const drivers = await db.Driver.findAll({ where: whereClause, attributes: ['id'] });
        
        if (drivers.length === 0) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على مناديب مطابقة للبحث' });
        }

        // Create Blast History
        const blast = await db.DriverNotificationBlast.create({
            senderId: req.user.id, // Current authenticated employee (ops)
            title,
            message,
            type: type || 'normal',
            filters: filters || {},
            recipientsCount: drivers.length
        });

        // Bulk Create Individual Notifications
        const notificationsToCreate = drivers.map(d => ({
            driverId: d.id,
            blastId: blast.id,
            title,
            message,
            type: blast.type,
            isRead: false
        }));

        await db.DriverNotification.bulkCreate(notificationsToCreate);

        return res.json({ success: true, message: `تم الإرسال بنجاح لعدد ${drivers.length} مندوب`, blast });
    } catch (err) {
        console.error("blastNotifications error: ", err);
        return res.status(500).json({ success: false, message: 'حدث خطأ بالسيرفر' });
    }
};

exports.getBlastsHistory = async (req, res) => {
    try {
        const blasts = await db.DriverNotificationBlast.findAll({
            order: [['createdAt', 'DESC']],
            include: [{ model: db.Auth, as: 'sender', attributes: ['id', 'fullName', 'email'] }]
        });
        return res.json({ success: true, blasts });
    } catch (err) {
        console.error("getBlastsHistory error: ", err);
        return res.status(500).json({ success: false, message: 'حدث خطأ بالسيرفر' });
    }
};
