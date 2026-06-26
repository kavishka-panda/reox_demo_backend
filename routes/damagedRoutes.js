const express = require('express');
const router = express.Router();
const damagedController = require('../controllers/damagedController');

router.post('/add', damagedController.createDamagedRecord);
router.get('/table-data', damagedController.getDamagedTableData);

router.get('/search', damagedController.searchDamaged);
router.get('/summary-cards', damagedController.getDamagedDashboardSummary);

router.put('/update-status', damagedController.updateDamagedStatus);

module.exports = router;