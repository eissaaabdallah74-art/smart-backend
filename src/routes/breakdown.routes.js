const express = require('express');
const router = express.Router();
const breakdownController = require('../controllers/breakdown.controller');

router.post('/', breakdownController.saveBreakdown);
router.get('/', breakdownController.getBreakdowns);
router.put('/status', breakdownController.updateStatus);
router.put('/lock', breakdownController.lockBreakdown);

module.exports = router;
