const express = require('express');
const router = express.Router();
const courierClearanceController = require('../controllers/courier-clearance.controller');

router.get('/:id/clearance', courierClearanceController.getCourierClearanceDetails);
router.post('/:id/approve', courierClearanceController.submitClearanceApproval);

module.exports = router;
