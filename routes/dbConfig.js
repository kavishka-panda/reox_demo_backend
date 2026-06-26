const express = require('express');
const router = express.Router();
const dbConfigController = require('../controllers/dbConfigController');

// Get all configurations
router.get('/', dbConfigController.getAllConfigs);

// Get active configuration
router.get('/active', dbConfigController.getActiveConfig);

// Get current mode
router.get('/current-mode', dbConfigController.getCurrentMode);

// Fetch and store online db config from server
router.get('/fetch-config', dbConfigController.fetchOnlineDatabaseData);

// Get active db config with decrypted password
router.get('/db-config', dbConfigController.getDbConfig);

// Get configuration by ID
router.get('/:id', dbConfigController.getConfigById);

// Test connection
router.post('/test-connection', dbConfigController.testConnection);

// Create new configuration
router.post('/', dbConfigController.createConfig);

// Update configuration
router.put('/:id', dbConfigController.updateConfig);

// Switch mode (online/offline)
router.post('/switch-mode', dbConfigController.switchMode);

// Delete configuration
router.delete('/:id', dbConfigController.deleteConfig);

module.exports = router;
