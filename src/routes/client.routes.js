// src/routes/client.routes.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const clientPricingRoutes = require('./client-pricing.routes');

// كل routes محمية
router.use(authMiddleware);

// Mount Pricing Sub-routes
router.use('/:clientId/pricing', clientPricingRoutes);

// GET /api/clients
router.get('/', clientController.getAllClients);

// ✅ BULK IMPORT لازم قبل /:id
router.post('/bulk-import', clientController.bulkImportClients);

// GET /api/clients/:id
router.get('/:id', clientController.getClientById);

// POST /api/clients
router.post('/', clientController.createClient);

// PUT /api/clients/:id
router.put('/:id', clientController.updateClient);

// DELETE /api/clients/:id
router.delete('/:id', clientController.deleteClient);

module.exports = router;