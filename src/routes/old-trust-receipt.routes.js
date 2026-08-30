const express = require("express");
const router = express.Router();
const oldTrustReceiptController = require("../controllers/old-trust-receipt.controller");

router.get("/", oldTrustReceiptController.getAllOldTrustReceipts);
router.post("/", oldTrustReceiptController.createOldTrustReceipt);
router.put("/:id", oldTrustReceiptController.updateOldTrustReceipt);
router.delete("/:id", oldTrustReceiptController.deleteOldTrustReceipt);

module.exports = router;
