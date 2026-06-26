const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

// GET request to fetch roles
router.get('/', roleController.getRoles);

module.exports = router;