const express = require('express');
const router = express.Router();
const controller = require('../controllers/driver-financial-request.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect these routes with normal Admin auth
router.use(authMiddleware);

router.get('/', controller.listRequests);
router.put('/:id/decide', controller.decideRequest);

module.exports = router;
