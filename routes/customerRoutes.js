
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const validateCustomer = require('../middleware/customerValidator');

router.post('/add', validateCustomer.validateCustomer, customerController.addCustomer);
router.get('/all', customerController.getAllCustomers);
// Route for toggling customer status
router.put('/:customerId/status', customerController.toggleStatus);
// Route for updating customer phone number
router.put('/:customerId/phone',validateCustomer.validateCustomerNumber, customerController.updatePhone);
// routes/customerRoutes.js
router.get('/search', customerController.searchCustomers);
router.put('/:customerId/update', customerController.updateCustomer);

module.exports = router;