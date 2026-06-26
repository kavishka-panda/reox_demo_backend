const express = require('express');
const router = express.Router();
const productTypeController = require('../controllers/productTypeController');

router.get('/search', productTypeController.searchProductTypes);
router.post('/', productTypeController.addProductType);
router.get('/', productTypeController.getProductTypes);
router.put('/:id', productTypeController.updateProductType);
router.delete('/:id', productTypeController.deleteProductType);

module.exports = router;