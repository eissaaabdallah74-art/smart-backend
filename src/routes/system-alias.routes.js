const express = require('express');
const router = express.Router();
const systemAliasController = require('../controllers/system-alias.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRoles } = require('../middlewares/role.helpers');

router.use(authMiddleware);
// Only admins can manage system aliases
router.use(requireRoles('admin'));

router.get('/', systemAliasController.findAll);
router.post('/', systemAliasController.create);
router.put('/:id', systemAliasController.update);
router.delete('/:id', systemAliasController.delete);

module.exports = router;
