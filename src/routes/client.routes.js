// src/routes/client.routes.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');

// GET /api/clients
router.get('/', clientController.getAllClients);

// GET /api/clients/:id
router.get('/:id', clientController.getClientById);

// BULK IMPORT /api/clients/bulk-import
router.post('/bulk-import', clientController.bulkImportClients);

// POST /api/clients
router.post('/', clientController.createClient);

// PUT /api/clients/:id
router.put('/:id', clientController.updateClient);

// DELETE /api/clients/:id
router.delete('/:id', clientController.deleteClient);

module.exports = router;
