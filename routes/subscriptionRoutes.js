const express = require('express');
const router = express.Router();
const licenceManagementController = require('../controllers/licenceManagementController');
const subscriptionLocalController = require('../controllers/subscriptionLocalController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

// Route::post('license/validate', [LicenceManagementController::class, 'validateDevice']);
router.post('/validate', licenceManagementController.validateDevice);

// Route::post('license/verify-otp', [LicenceManagementController::class, 'verifyOtp']);
router.post('/verify-otp', licenceManagementController.verifyOtp);

// Route::post('license/resend-otp', [LicenceManagementController::class, 'resendOtp']);
router.post('/resend-otp', licenceManagementController.resendOtp);

// Route to get customer profile using JWT token
router.get('/profile', licenceManagementController.getProfile);

// Route to get customer subscription using JWT token
router.get('/customer-subscription', licenceManagementController.getCustomerSubscription);

// Route to get subscription status from local DB
router.get('/status', licenceManagementController.getStatus);

// Route to get subscription details from local DB without signature
router.get('/getSubscriptionLocal', subscriptionLocalController.getSubscriptionLocal);

// Route to remove license key (admin only)
router.delete('/license/remove', licenceManagementController.licenceKeyRemove);


module.exports = router;
