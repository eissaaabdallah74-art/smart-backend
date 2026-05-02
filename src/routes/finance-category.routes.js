const express = require('express');
const router = express.Router();
const financeCategoryController = require('../controllers/finance-category.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireFinanceorAdmin } = require('../middlewares/role.helpers');

router.use(authMiddleware, requireFinanceorAdmin);

router.get('/', financeCategoryController.getAllCategories);
router.get('/:id', financeCategoryController.getCategoryById);
router.post('/', financeCategoryController.createCategory);
router.put('/:id', financeCategoryController.updateCategory);
router.delete('/:id', financeCategoryController.deleteCategory);

module.exports = router;
