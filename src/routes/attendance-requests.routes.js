// src/routes/attendance-requests.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/attendance-requests.controller");

// ✅ عدّل المسار حسب مشروعك الفعلي
const { requireAdmin, requireHRorAdmin } = require("../middlewares/role.helpers");

// ============================
// Employee (any logged-in user)
// ============================
// NOTE: هنا نفترض إن auth middleware اللي بيحط req.user شغال قبل الراوتر (global)
// لو مش شغال، حط requireAuth هنا (حسب مشروعك)
router.post("/mine", ctrl.createMyRequest);
router.get("/mine", ctrl.listMyRequests);
router.delete("/:id", ctrl.cancelMyRequest);

// ============================
// Admin/HR - Review & Decide
// ============================
// لو عايزها Admin فقط: استخدم requireAdmin بدل requireHRorAdmin
router.get("/", requireHRorAdmin, ctrl.listAllRequests);
router.patch("/:id/decision", requireHRorAdmin, ctrl.decideRequest);

module.exports = router;
