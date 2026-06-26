const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');

router.get('/', quotationController.getAllQuotations);
router.post('/', quotationController.createQuotation);
router.get('/:id', quotationController.getQuotation);
router.put('/:id', quotationController.updateQuotation);

module.exports = router;
