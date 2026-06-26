const prisma = require("../config/prismaClient");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, '..', 'config', 'license_token.json');

/**
 * Custom error for authentication failures.
 * The controller can catch this and return a structured JSON response to the frontend.
 */
class AuthenticationError extends Error {
    constructor(message, uiAction = 'SHOW_LOGIN') {
        super(message);
        this.name = 'AuthenticationError';
        this.ui_action = uiAction;
    }
}

class LicenceManagementModel {
    // -----------------------------------------------------------------
    // Helper: base URL
    // -----------------------------------------------------------------
    static getSubscriptionApiBaseUrl() {
        const rawBaseUrl = process.env.SUBSCRIPTION_CHECK_API;
        if (!rawBaseUrl || !rawBaseUrl.trim()) {
            throw new Error('SUBSCRIPTION_CHECK_API is not configured.');
        }
        return rawBaseUrl.replace(/\/$/, '');
    }

    // -----------------------------------------------------------------
    // Token storage helpers
    // -----------------------------------------------------------------
    static storeAccessToken(token) {
        try {
            const configDir = path.dirname(TOKEN_PATH);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(TOKEN_PATH, JSON.stringify({
                access_token: token,
                updated_at: new Date().toISOString()
            }, null, 2), 'utf-8');
        } catch (error) {
            console.error("Failed to store access token:", error.message);
        }
    }

    static getStoredAccessToken() {
        try {
            if (fs.existsSync(TOKEN_PATH)) {
                const fileContent = fs.readFileSync(TOKEN_PATH, 'utf-8');
                const parsed = JSON.parse(fileContent);
                return parsed.access_token || null;
            }
        } catch (error) {
            console.error("Failed to read stored license token:", error.message);
        }
        return null;
    }

    /**
     * Delete the local token file (e.g. on 401/403).
     */
    static clearStoredToken() {
        try {
            if (fs.existsSync(TOKEN_PATH)) {
                fs.unlinkSync(TOKEN_PATH);
                console.log("Local token file removed after authentication failure.");
            }
        } catch (error) {
            console.error("Failed to clear token file:", error.message);
        }
    }

    // -----------------------------------------------------------------
    // Central 401/403 handler – clears state & throws a structured error
    // -----------------------------------------------------------------
    static async handleUnauthenticated() {
        // 1. Remove invalid token file
        this.clearStoredToken();

        // 2. Mark all local subscriptions as unauthenticated
        try {
            await prisma.subscription.updateMany({
                data: { status: 'unauthenticated', last_sync_at: new Date() }
            });
        } catch (dbError) {
            console.error("Failed to update subscription status after auth failure:", dbError.message);
        }

        // 3. Throw a dedicated error that controllers can catch
        throw new AuthenticationError(
            'Your session has expired. Please re-enter your license key.',
            'SHOW_LOGIN'
        );
    }

    // -----------------------------------------------------------------
    // Core license operations
    // -----------------------------------------------------------------

    /**
     * Validate the device with a license key
     */
    static async validateDevice(licenseKey, deviceId) {
        try {
            const baseUrl = this.getSubscriptionApiBaseUrl();
            const apiUrl = `${baseUrl}/api/license/validate`;

            const response = await axios.post(apiUrl, {
                license_key: licenseKey,
                device_id: deviceId
            });

            const responseData = response.data;
            const accessToken = responseData?.data?.data?.access_token ||
                responseData?.access_token ||
                responseData?.data?.access_token;
            if (accessToken) {
                LicenceManagementModel.storeAccessToken(accessToken);
                await LicenceManagementModel.getProfile(deviceId);
            }

            return LicenceManagementModel.sanitizeFrontendResponse(responseData);
        } catch (error) {
            // Handle 401 or 403 as authentication failure → set unauthenticated
            if (error.response?.status === 401 || error.response?.status === 403) {
                return await this.handleUnauthenticated(); // throws, won't return
            }

            if (error.response && error.response.data) {
                const responseData = error.response.data;
                // No longer setting status to 'blocked' – just forward the error
                if (responseData.error && responseData.error.message) {
                    throw new Error(responseData.error.message);
                }
                throw new Error(responseData.message || JSON.stringify(responseData));
            }
            console.error("Connection Error in validateDevice:", error.message);
            throw new Error(error.message || 'Failed to connect to the subscription server for validation.');
        }
    }

    /**
     * Verify the OTP for a license
     */
    static async verifyOtp(licenseKey, deviceId, otp, deviceName) {
        try {
            const baseUrl = this.getSubscriptionApiBaseUrl();
            const apiUrl = `${baseUrl}/api/license/verify-otp`;

            const response = await axios.post(apiUrl, {
                license_key: licenseKey,
                device_id: deviceId,
                otp: otp,
                device_name: deviceName
            });

            const responseData = response.data;
            const accessToken = responseData?.data?.data?.access_token ||
                responseData?.access_token ||
                responseData?.data?.access_token;
            if (accessToken) {
                LicenceManagementModel.storeAccessToken(accessToken);
                await LicenceManagementModel.getProfile(deviceId);
            }

            return LicenceManagementModel.sanitizeFrontendResponse(responseData);
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                return await this.handleUnauthenticated();
            }

            if (error.response && error.response.data) {
                const responseData = error.response.data;
                // Removed 'blocked' update – just re-throw
                if (responseData.error && responseData.error.message) {
                    throw new Error(responseData.error.message);
                }
                throw new Error(responseData.message || JSON.stringify(responseData));
            }
            throw new Error(error.message || 'Failed to connect to the subscription server to verify OTP.');
        }
    }

    /**
     * Resend OTP for a license
     */
    static async resendOtp(licenseKey, deviceId, deviceName) {
        try {
            const baseUrl = this.getSubscriptionApiBaseUrl();
            const apiUrl = `${baseUrl}/api/license/resend-otp`;

            const response = await axios.post(apiUrl, {
                license_key: licenseKey,
                device_id: deviceId,
                device_name: deviceName
            });

            const responseData = response.data;
            return LicenceManagementModel.sanitizeFrontendResponse(responseData);
        } catch (error) {
            // Even resend could get a 401/403 if the license is invalid/expired
            if (error.response?.status === 401 || error.response?.status === 403) {
                return await this.handleUnauthenticated();
            }

            if (error.response && error.response.data) {
                const responseData = error.response.data;
                // No status update
                if (responseData.error && responseData.error.message) {
                    throw new Error(responseData.error.message);
                }
                throw new Error(responseData.message || JSON.stringify(responseData));
            }
            throw new Error(error.message || 'Failed to connect to the subscription server to resend OTP.');
        }
    }

    // -----------------------------------------------------------------
    // Authenticated data fetch methods (sensitive to token invalidity)
    // -----------------------------------------------------------------

    /**
     * Fetch customer profile from the central API using the stored JWT
     */
    static async getProfile(deviceId = '') {
        try {
            if (!deviceId) {
                console.error("Device ID is missing in getProfile call");
            }

            const token = this.getStoredAccessToken();
            if (!token) {
                // No token at all => force re‑login
                await this.handleUnauthenticated(); // will throw
            }

            const baseUrl = this.getSubscriptionApiBaseUrl();
            const apiUrl = `${baseUrl}/api/customer/profile`;

            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'device-id': deviceId,
                    Accept: 'application/json'
                },
                params: {
                    device_id: deviceId
                }
            });

            console.log("Profile Response:", response.data);

            const profileData = response.data?.data?.data || response.data?.data;

            if (profileData && profileData.license_key) {
                // Clear old records to keep only the active license
                await prisma.subscription.deleteMany({});

                let expiryDateObj = new Date();
                if (profileData.expiry_date) {
                    const d = new Date(profileData.expiry_date);
                    expiryDateObj = new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00Z`);
                }

                await prisma.subscription.create({
                    data: {
                        id: profileData.id,
                        license_key: profileData.license_key,
                        expiry_date: expiryDateObj,
                        db_type: profileData.db_type || 'offline',
                        signature: profileData.signature,
                        status: profileData.status || 'active',
                        last_sync_at: new Date()
                    }
                });
            }

            return LicenceManagementModel.sanitizeFrontendResponse(response.data);
        } catch (error) {
            // 401/403 → token invalid or session expired
            if (error.response?.status === 401 || error.response?.status === 403) {
                await this.handleUnauthenticated(); // throws AuthenticationError
            }

            // Other server errors – do NOT alter local status
            if (error.response && error.response.data) {
                const responseData = error.response.data;
                // No 'blocked' update
                if (responseData.error && responseData.error.message) {
                    throw new Error(responseData.error.message);
                }
                throw new Error(responseData.message || JSON.stringify(responseData));
            }

            throw new Error(error.message || 'Failed to connect to the subscription server to retrieve profile.');
        }
    }

    /**
     * Fetch customer subscription details from the central API
     */
    static async getCustomerSubscription(deviceId = '') {
        try {
            const token = this.getStoredAccessToken();
            if (!token) {
                await this.handleUnauthenticated();
            }

            const baseUrl = this.getSubscriptionApiBaseUrl();
            const apiUrl = `${baseUrl}/api/customer/subscription`;

            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    ...(deviceId ? { 'device-id': deviceId } : {})
                },
                ...(deviceId ? { params: { device_id: deviceId } } : {})
            });
            console.log("Customer Subscription Response:", response.data);

            return LicenceManagementModel.sanitizeFrontendResponse(response.data);
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                await this.handleUnauthenticated();
            }

            if (error.response && error.response.data) {
                const responseData = error.response.data;
                // No local status change
                if (responseData.error && responseData.error.message) {
                    throw new Error(responseData.error.message);
                }
                throw new Error(responseData.message || JSON.stringify(responseData));
            }

            throw new Error(error.message || 'Failed to connect to the subscription server to retrieve subscription details.');
        }
    }

    // -----------------------------------------------------------------
    // Local status checks (also proactive about missing token)
    // -----------------------------------------------------------------

    /**
     * Get current subscription status from local DB to decide UI state.
     */
    static async getStatus() {
        try {
            const subscription = await prisma.subscription.findFirst();

            // If no token file exists but we have a license in DB, the session is dead.
            const tokenExists = !!this.getStoredAccessToken();

            if (!subscription || !subscription.license_key) {
                return {
                    status: "LICENSE_NOT_ASSIGNED",
                    message: "No license found. Please enter your license key.",
                    ui_action: "SHOW_LOGIN"
                };
            }

            // Account disabled (status = 'blocked') – this state will only be reached
            // if the server **explicitly** sets it in a successful profile response.
            if (subscription.status === 'blocked') {
                return {
                    status: "ACCOUNT_BLOCKED",
                    message: "Your account has been disabled. Please contact support.",
                    license_key: subscription.license_key,
                    ui_action: "SHOW_LOCK_SCREEN"
                };
            }

            // If token is missing while we supposedly have a valid license, force re‑auth.
            if (!tokenExists && subscription.status !== 'blocked' && subscription.status !== 'expired') {
                return {
                    status: "SESSION_EXPIRED",
                    message: "Your authentication has expired. Please log in again.",
                    license_key: subscription.license_key,
                    ui_action: "SHOW_LOGIN"
                };
            }

            const today = new Date();
            const expiryDate = new Date(subscription.expiry_date);

            if (today > expiryDate) {
                return {
                    status: "LICENSE_EXPIRED",
                    message: "Your subscription has expired. Please renew to continue.",
                    expiry_date: subscription.expiry_date,
                    license_key: subscription.license_key,
                    ui_action: "SHOW_RENEWAL"
                };
            }

            const isOnlineDb = (subscription.db_type || '').toLowerCase() === 'online';
            const hasLastSync = !!subscription.last_sync_at;
            const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
            const lastSyncAgeMs = hasLastSync ? (today.getTime() - new Date(subscription.last_sync_at).getTime()) : 0;

            if (isOnlineDb && hasLastSync && lastSyncAgeMs > sevenDaysInMs) {
                return {
                    status: "INTERNET_INACTIVE_7_DAYS",
                    message: "Internet has not been active for 7 days.",
                    expiry_date: subscription.expiry_date,
                    license_key: subscription.license_key,
                    ui_action: "SHOW_DASHBOARD"
                };
            }

            return {
                status: "VALID",
                message: "License is active.",
                expiry_date: subscription.expiry_date,
                license_key: subscription.license_key,
                ui_action: "SHOW_DASHBOARD"
            };
        } catch (error) {
            console.error("Error in getStatus:", error.message);
            return {
                status: "ERROR",
                message: "Internal local database error.",
                ui_action: "SHOW_ERROR"
            };
        }
    }

    // -----------------------------------------------------------------
    // Utility: sanitize responses for frontend
    // -----------------------------------------------------------------
    static sanitizeFrontendResponse(payload) {
        if (!payload) return payload;

        const sanitized = JSON.parse(JSON.stringify(payload));
        const target = sanitized?.data?.data || sanitized?.data;
        if (target && typeof target === 'object') {
            delete target.signature;
            delete target.license_key;
            delete target.access_token;
            delete target.id;
        }
        return sanitized;
    }

    // -----------------------------------------------------------------
    // Stub methods (preserved as in original)
    // -----------------------------------------------------------------
    static async checkAndSyncStatus(licenseKey) {
        return true;
    }

    static async checkAccess() {
        return true;
    }

    // -----------------------------------------------------------------
    // Remove license – clears token and deletes all subscriptions
    // -----------------------------------------------------------------
    // Add this inside the LicenceManagementModel class, replacing the old removeLicense

    static async removeLicense(licenseKey) {
        if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
            throw new Error('License key is required for verification.');
        }

        const trimmedKey = licenseKey.trim();

        // Fetch the last (and only) subscription record
        const subscription = await prisma.subscription.findFirst();

        if (!subscription) {
            throw new Error('No license is stored locally to remove.');
        }

        // Verify the provided key matches the stored key
        if (subscription.license_key !== trimmedKey) {
            throw new Error('The provided license key does not match the stored license.');
        }

        // Verification passed → clear token and delete all subscriptions
        this.clearStoredToken();

        try {
            await prisma.subscription.deleteMany({});
            console.log('All subscription records removed.');
        } catch (dbError) {
            console.error('Failed to delete subscriptions:', dbError.message);
            throw new Error('Could not remove license from local database.');
        }

        return { success: true };
    }
}

module.exports = LicenceManagementModel;