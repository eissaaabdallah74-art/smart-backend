// src/routes/vendor.routes.js
const router = require("express").Router();
const vendor = require("../controllers/vendor.controller");

// لو عندك auth middleware حطه هنا (مثال)
// const { requireAuth, requireRole } = require("../middleware/auth");
// router.use(requireAuth);

router.get("/", vendor.getAllVendors);
router.get("/:id", vendor.getVendorById);
router.post("/", vendor.createVendor);
router.put("/:id", vendor.updateVendor);
router.delete("/:id", vendor.deleteVendor);

module.exports = router;