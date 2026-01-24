// src/routes/client-contracts.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/client-contracts.controller');

// GET /api/client-contracts
router.get('/', ctrl.getAllContracts);

// GET /api/client-contracts/:id
router.get('/:id', ctrl.getContractById);

// BULK IMPORT
router.post('/bulk-import', ctrl.bulkImportContracts);

// CRUD
router.post('/', ctrl.createContract);
router.put('/:id', ctrl.updateContract);
router.delete('/:id', ctrl.deleteContract);

module.exports = router;
