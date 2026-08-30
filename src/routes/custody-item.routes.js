const express = require('express');
const router = express.Router();
const custodyItemController = require('../controllers/custody-item.controller');

router.get('/', custodyItemController.getAllCustodyItems);
router.get('/:id', custodyItemController.getCustodyItemById);
router.post('/', custodyItemController.createCustodyItem);
router.put('/:id', custodyItemController.updateCustodyItem);
router.delete('/:id', custodyItemController.deleteCustodyItem);

module.exports = router;
