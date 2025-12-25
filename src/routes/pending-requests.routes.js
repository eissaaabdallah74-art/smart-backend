// src/routes/pending-requests.routes.js
const express = require('express');
const router = express.Router();

const pendingRequestController = require('../controllers/pending-request.controller');

// لو عندك middlewares للـ auth/roles ضيفها هنا قبل الهاندلرز

router.get('/', pendingRequestController.getPendingRequests);
router.get('/:id', pendingRequestController.getPendingRequestById);

// ✅ bulk import
router.post('/bulk-import', pendingRequestController.bulkImportPendingRequests);

router.post('/', pendingRequestController.createPendingRequest);
router.put('/:id', pendingRequestController.updatePendingRequest);
router.delete('/:id', pendingRequestController.deletePendingRequest);

module.exports = router;
