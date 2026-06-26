const express = require('express');
const router = express.Router();
const paymentTypeController = require('../controllers/paymentTypeController');

//get payment types 
router.get('/', paymentTypeController.getPaymentTypes);

module.exports = router;

