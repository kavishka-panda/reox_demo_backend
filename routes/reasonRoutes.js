const express = require('express');
const router = express.Router();
const reasonController = require('../controllers/reasonController');

router.get('/all', reasonController.getReasonList);

module.exports = router;