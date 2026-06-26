const express = require('express');
const cashSessionController = require('../controllers/cashSessionController');

const router = express.Router();

router.get('/cash-sessions/check', cashSessionController.checkActiveCashSession);
router.get('/cashier-counters', cashSessionController.getCashierCounters);
router.post('/cash-sessions', cashSessionController.createCashSession);

// New routes for accounts dashboard
router.get('/cash-sessions', cashSessionController.getAllSessions);
router.get('/cash-sessions/:id', cashSessionController.getSessionDetails);
router.put('/cash-sessions/:id/close', cashSessionController.closeSession);

module.exports = router;
