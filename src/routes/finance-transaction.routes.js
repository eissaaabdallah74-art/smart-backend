const express = require('express');
const router = express.Router();
const financeTransactionController = require('../controllers/finance-transaction.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireFinanceorAdmin } = require('../middlewares/role.helpers');

router.use(authMiddleware, requireFinanceorAdmin);

router.get('/', financeTransactionController.getAllTransactions);
router.get('/summary', financeTransactionController.getFinanceSummary);
router.get('/:id', financeTransactionController.getTransactionById);
router.post('/', financeTransactionController.createTransaction);
router.put('/:id', financeTransactionController.updateTransaction);
router.delete('/:id', financeTransactionController.deleteTransaction);

module.exports = router;
