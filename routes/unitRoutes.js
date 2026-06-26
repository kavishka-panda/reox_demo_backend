const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

router.get('/search', unitController.searchUnits);
router.post('/', unitController.addUnit);
router.get('/', unitController.getUnits);
router.put('/:id', unitController.updateUnit);
router.delete('/:id', unitController.deleteUnit);

module.exports = router;