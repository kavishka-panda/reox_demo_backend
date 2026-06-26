const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin sync status endpoint
router.get('/sync-status', adminController.getSyncStatus);

module.exports = router;