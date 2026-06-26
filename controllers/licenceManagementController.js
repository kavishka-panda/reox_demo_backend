const { execSync } = require('child_process');
const os = require('os');
const LicenceManagementModel = require('../models/licenceManagementModel');

function getWindowsUUID() {
    try {
        const stdout = execSync('wmic csproduct get uuid').toString();
        return stdout.split('\n')[1].trim();
    } catch (error) {
        return null;
    }
}

function getDeviceId(req = {}) {
    return req?.body?.device_id || req?.query?.device_id || req?.headers?.['device-id'] || process.env.DEVICE_ID || getWindowsUUID();
}

const validateDevice = async (req, res) => {
    try {
        const { license_key } = req.body;

        // Basic validation
        if (!license_key) {
            return res.status(400).json({
                success: false,
                message: 'License key is required'
            });
        }

        const device_id = getDeviceId(req);

        if (!device_id) {
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve unique device ID. Provide device_id in the request or set DEVICE_ID in the environment.'
            });
        }

        const result = await LicenceManagementModel.validateDevice(license_key, device_id);

        res.json({
            success: true,
            message: 'Device validation process initiated',
            data: result
        });
    } catch (error) {
        // Check if the error has a status code attached (from model)
        const statusCode = error.statusCode || 500;
        console.error('Validation Error:', error.message);
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp, license_key } = req.body;

        // Basic validation
        if (!otp || !license_key) {
            return res.status(400).json({
                success: false,
                message: 'OTP and License key are required'
            });
        }

        const device_id = getDeviceId(req);

        if (!device_id) {
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve unique device ID. Provide device_id in the request or set DEVICE_ID in the environment.'
            });
        }

        // Get the actual computer name
        const device_name = os.hostname();

        const result = await LicenceManagementModel.verifyOtp(license_key, device_id, otp, device_name);

        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: result
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('OTP Verification Error:', error.message);
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const device_id = getDeviceId(req) || '';
        const profileData = await LicenceManagementModel.getProfile(device_id);

        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: profileData
        });
    } catch (error) {
        if (error.name === 'AuthenticationError') {
            return res.status(401).json({
                status: 'TOKEN_EXPIRED',
                message: error.message,
                ui_action: error.ui_action
            });
        }
        // Handle other errors
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

const getCustomerSubscription = async (req, res) => {
    try {
        const device_id = getDeviceId(req) || '';
        const subscriptionData = await LicenceManagementModel.getCustomerSubscription(device_id);

        res.json({
            success: true,
            message: 'Customer subscription retrieved successfully',
            data: subscriptionData
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('Customer Subscription Error:', error.message);
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const getStatus = async (req, res) => {
    try {
        const statusData = await LicenceManagementModel.getStatus();

        res.json({
            success: true,
            message: 'Subscription status retrieved successfully',
            data: statusData
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('Status Fetch Error:', error.message);
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { license_key } = req.body;

        // Basic validation
        if (!license_key) {
            return res.status(400).json({
                success: false,
                message: 'License key is required'
            });
        }

        const device_id = getDeviceId(req);

        if (!device_id) {
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve unique device ID. Provide device_id in the request or set DEVICE_ID in the environment.'
            });
        }

        // Get the actual computer name
        const device_name = os.hostname();

        const result = await LicenceManagementModel.resendOtp(license_key, device_id, device_name);

        res.json({
            success: true,
            message: 'OTP resent successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const licenceKeyRemove = async (req, res) => {
    try {
        // Expect license_key in request body (or fallback to query/params)
        const { license_key } = req.body;

        if (!license_key) {
            return res.status(400).json({
                success: false,
                message: 'License key is required to remove the license.'
            });
        }

        await LicenceManagementModel.removeLicense(license_key);

        res.json({
            success: true,
            message: 'License key removed successfully.'
        });
    } catch (error) {
        console.error('Remove License Error:', error.message);

        // Distinguish between verification errors and internal failures
        const statusCode = error.message.includes('match') || 
                           error.message.includes('stored') ? 400 : 500;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};
// Then include it in the module.exports object:
module.exports = {
    validateDevice,
    verifyOtp,
    resendOtp,
    getProfile,
    getCustomerSubscription,
    getStatus,
    licenceKeyRemove   // <-- add this
};
