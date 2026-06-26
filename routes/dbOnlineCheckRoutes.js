const express = require('express');
const router = express.Router();
const dbOnlineCheckController = require('../controllers/dbOnlineCheckController');

// Returns true when subscription.db_type is 'online', otherwise false
router.get('/check', dbOnlineCheckController.checkIsOnline);

module.exports = router;
