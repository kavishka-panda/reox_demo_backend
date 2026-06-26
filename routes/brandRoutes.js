const express = require('express');
const router = express.Router();
const commonController = require('../controllers/brandController');

router.get('/search', commonController.searchBrands);
router.post('/', commonController.addBrand);
router.get('/', commonController.getBrands);
router.put('/:id', commonController.updateBrand);
router.delete('/:id', commonController.deleteBrand);

module.exports = router;