const express = require("express");
const router = express.Router();
const opsHrRequestController = require("../controllers/ops-hr-request.controller");

router.get("/inactive-couriers", opsHrRequestController.getInactiveCouriers);
router.post("/", opsHrRequestController.createRequest);
router.get("/", opsHrRequestController.getRequests);
router.put("/:id", opsHrRequestController.updateRequest);
router.post("/:id/enlist", opsHrRequestController.enlistCourier);
router.get("/pending-count", opsHrRequestController.getPendingCount);

module.exports = router;
