// app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const authMiddleware = require('./src/middlewares/auth.middleware');

const db = require('./src/models');
const authRoutes = require('./src/routes/auth.routes');
const clientRoutes = require('./src/routes/client.routes');
const driverRoutes = require('./src/routes/driver.routes');
const trackingRoutes = require('./src/routes/tracking.routes');
const interviewRoutes = require('./src/routes/interview.routes');
const hubRoutes = require('./src/routes/hub.routes');
const zoneRoutes = require('./src/routes/zone.routes');
const pendingRequestsRouter = require('./src/routes/pending-requests.routes');
const callsRoutes = require('./src/routes/calls.routes');
const tasksRouter = require('./src/routes/tasks.routes');
const reportRoutes = require('./src/routes/report.routes');





const app = express();

app.use(cors());

// نزود الـ limit للـ JSON و form-urlencoded
app.use(
  express.json({
    limit: '10mb', // زوّدها لو الملف أكبر
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);


// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Smart Backend API is running' });
});

// ===== Public Routes =====
app.use('/api/auth', authRoutes);

// ===== Protected Routes =====
app.use('/api/clients', authMiddleware, clientRoutes);
app.use('/api/drivers', authMiddleware, driverRoutes);
app.use('/api/tracking', authMiddleware, trackingRoutes);
app.use('/api/interviews', authMiddleware, interviewRoutes);
app.use('/api/hubs', authMiddleware, hubRoutes);
app.use('/api/zones', authMiddleware, zoneRoutes);
app.use('/api/pending-requests', pendingRequestsRouter);
app.use('/api/calls', callsRoutes);
app.use('/api/tasks', tasksRouter);
app.use('/api/reports', reportRoutes);





// ====== DB Connection & Seeding ======
(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');

    await db.sequelize.sync();
    console.log('✅ Models synchronized with database.');

    const { Auth } = db;

    const adminEmail = 'admin@smart.com';
    const adminPlainPassword = process.env.ADMIN_PASSWORD || 'admin';
    const adminHashedPassword = await bcrypt.hash(adminPlainPassword, 10);

    let admin = await Auth.findOne({ where: { email: adminEmail } });

    if (!admin) {
      // مفيش أدمن → نعمل واحد جديد
      admin = await Auth.create({
        fullName: 'System Admin',
        email: adminEmail,
        password: adminHashedPassword,
        role: 'admin',
        isActive: true,
      });

      console.log(
        '👑 Admin user CREATED (admin@smart.com / admin) - password hashed'
      );
    } else {
      // موجود بالفعل → نتأكد من حالته ونعمل migration لو الباسورد مش bcrypt
      let needSave = false;

      // لو الباسورد مش باين عليها إنها bcrypt (مش بادئة بـ $2)
      if (!admin.password || !admin.password.startsWith('$2')) {
        admin.password = adminHashedPassword;
        needSave = true;
        console.log('🔐 Admin password was plain → rehashed now.');
      }

      if (admin.role !== 'admin') {
        admin.role = 'admin';
        needSave = true;
      }

      if (!admin.isActive) {
        admin.isActive = true;
        needSave = true;
      }

      if (!admin.fullName) {
        admin.fullName = 'System Admin';
        needSave = true;
      }

      if (needSave) {
        await admin.save();
        console.log('👑 Admin user UPDATED/normalized successfully.');
      } else {
        console.log('👑 Admin user already exists & is valid.');
      }
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
})();

module.exports = app;
