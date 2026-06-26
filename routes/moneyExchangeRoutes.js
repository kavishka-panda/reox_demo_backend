const express = require('express');
const router = express.Router();
const moneyExchangeController = require('../controllers/moneyExchangeController');
const { verifyToken } = require('../middleware/auth');

router.get('/balance', verifyToken, moneyExchangeController.getCurrentBalance);
router.post('/transaction', verifyToken, moneyExchangeController.createTransaction);
router.get('/history', verifyToken, moneyExchangeController.getTransactionHistory);

module.exports = router;
