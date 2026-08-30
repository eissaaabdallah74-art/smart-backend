const express = require('express');
const router = express.Router();
const controller = require('../controllers/weekly-invoice.controller');

router.post('/', controller.saveWeeklyInvoice);
router.get('/', controller.getWeeklyInvoices);
router.put('/status', controller.updateWeeklyStatus);
router.post('/consolidate', controller.consolidateMonthlyBreakdown);

module.exports = router;
