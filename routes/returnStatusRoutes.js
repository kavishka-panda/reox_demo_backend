const express = require('express');
const router = express.Router();
const returnStatusController = require('../controllers/returnStatusController');

router.get('/all', returnStatusController.getReturnStatusList);

module.exports = router;