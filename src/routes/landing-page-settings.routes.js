// src/routes/landing-page-settings.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/landing-page-settings.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'bg-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

const authMiddleware = require('../middlewares/auth.middleware');
const auditContextMiddleware = require('../middlewares/audit-context.middleware');

router.get('/', ctrl.getSettings);
router.put('/', authMiddleware, auditContextMiddleware, upload.single('backgroundImage'), ctrl.updateSettings);

module.exports = router;
