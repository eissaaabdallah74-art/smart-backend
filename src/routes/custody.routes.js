const express = require('express');
const router = express.Router();
const custodyController = require('../controllers/custody.controller');

router.get('/', custodyController.getAllCustodies);
router.get('/recipients', custodyController.getRecipientsList);
router.get('/:id', custodyController.getCustodyById);
router.post('/', custodyController.createCustody);
router.put('/:id', custodyController.updateCustody);
router.delete('/:id', custodyController.deleteCustody);

module.exports = router;
