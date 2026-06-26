const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');


// Product routes (Search by barcode is still used by POS)
router.get('/products/barcode/:barcode', posController.searchProductByBarcode);

// Invoice routes
router.post('/invoice', posController.createInvoice);
router.get('/invoices', posController.getAllInvoices);
router.get('/invoices/stats', posController.getInvoiceStats);
router.get('/invoice/:invoiceNo', posController.getInvoice);
router.post('/invoice/payment', posController.processInvoicePayment);
router.post('/credit/payment', posController.processCreditPayment);

// Route to convert bulk stock to loose stock
router.post('/convert', posController.convertBulkToLoose);
// Route to process return
router.post('/return', posController.processReturn);
router.get('/returns', posController.getReturnHistory);
router.get('/credit-history/:customerId', posController.getCreditPaymentHistory);

module.exports = router;