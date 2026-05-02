// src/routes/client-pricing.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const pricingController = require('../controllers/client-pricing.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Routes mounted at /api/v1/clients/:clientId/pricing
router.get('/', authMiddleware, pricingController.getClientPricings);
router.post('/', authMiddleware, pricingController.createPricing);
router.put('/:pricingId', authMiddleware, pricingController.updatePricing);
router.delete('/:pricingId', authMiddleware, pricingController.deletePricing);

module.exports = router;
