// Use local-only Prisma client since db_config table only exists in local database
const prisma = require('../config/prismaClient');
const crypto = require('crypto');
const axios = require('axios');
const LicenceManagementModel = require('./licenceManagementModel');
const subscriptionLocalModel = require('./subscriptionLocalModel');

const IV_LENGTH = 16;
// Use an env-provided key for local encryption; fallback order: ENCRYPTION_KEY, DB_CONFIG_ENCRYPTION_KEY, APP_KEY
const ENCRYPTION_KEY = process.env.APP_KEY;

function decryptLaravelPayload(encryptedString) {
    const appKey = process.env.APP_KEY || '';
    if (!appKey) {
        throw new Error('Laravel APP_KEY is missing. Set LARAVEL_APP_KEY (or APP_KEY) in backend/.env.');
    }

    const keyString = appKey.startsWith('base64:') ? appKey.substring(7) : appKey;
    const key = Buffer.from(keyString, 'base64');
    if (key.length !== 32) {
        throw new Error('Invalid Laravel APP_KEY. Expected base64-encoded 32-byte key.');
    }

    const payloadJson = Buffer.from(encryptedString, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload.iv || !payload.value) {
        throw new Error('Invalid Laravel encrypted payload format.');
    }

    const iv = Buffer.from(payload.iv, 'base64');
    const encrypted = Buffer.from(payload.value, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
}

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    if (!ENCRYPTION_KEY) {
        throw new Error('Local encryption key missing. Set ENCRYPTION_KEY (or DB_CONFIG_ENCRYPTION_KEY) in backend/.env.');
    }
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt sensitive data
 */
function decrypt(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // Laravel Crypt::encryptString() payload (base64 JSON)
    // 1) Try Laravel payload format
    try {
        return decryptLaravelPayload(text);
    } catch (error) {
        // ignore and try other formats
    }

    // 2) Try local format produced by `encrypt()` -> "iv:encryptedHex"
    try {
        if (!ENCRYPTION_KEY) return text;
        const parts = text.split(':');
        if (parts.length !== 2) return text;
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        // Keep original value when no decrypt strategy matches.
        return text;
    }
}

const dbConfigModel = {
    normalizeOnlineDatabaseResponse(rawData) {
        const nestedPayload = rawData?.data?.data || rawData?.data || rawData;

        if (!nestedPayload || typeof nestedPayload !== 'object') {
            throw new Error('Invalid online database response payload.');
        }

        return {
            customer_id: nestedPayload.customer_id,
            host: nestedPayload.host,
            port: String(nestedPayload.port || 3306),
            database: nestedPayload.db_name,
            user: nestedPayload.user_name,
            password: nestedPayload.password,
            created_at: nestedPayload.created_at,
            updated_at: nestedPayload.updated_at,
            deleted_at: nestedPayload.deleted_at
        };
    },

    async saveFetchedOnlineConfig(configData) {
        if (!configData?.host || !configData?.database || !configData?.user || !configData?.password) {
            throw new Error('Incomplete online database config payload.');
        }

        const existingActive = await prisma.db_config.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' }
        });

        if (existingActive) {
            await prisma.db_config.update({
                where: { id: existingActive.id },
                data: {
                    host: configData.host,
                    user: configData.user,
                    password: encrypt(configData.password),
                    database: configData.database,
                    port: String(configData.port || 3306),
                    mode: 'online',
                    is_active: true,
                    updated_at: new Date()
                }
            });

            return existingActive.id;
        }

        const created = await prisma.db_config.create({
            data: {
                host: configData.host,
                user: configData.user,
                password: encrypt(configData.password),
                database: configData.database,
                port: String(configData.port || 3306),
                mode: 'online',
                is_active: true
            }
        });

        return created.id;
    },

    async fetchOnlineDatabaseData(deviceId = '') {
        const token = LicenceManagementModel.getStoredAccessToken();
        if (!token) {
            throw new Error('Access token not found. Please log in or verify OTP first.');
        }

        const baseUrl = (process.env.SUBSCRIPTION_CHECK_API || '').replace(/\/$/, '');
        const apiUrl = `${baseUrl}/api/customer/online-database-details`;

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'device-id': deviceId,
                    Accept: 'application/json'
                }
            });

            // If API returns an encrypted `payload`, decrypt it using Laravel APP_KEY
            let payloadSource = response.data;
            if (response.data && typeof response.data.payload === 'string') {
                try {
                    const decrypted = decrypt(response.data.payload);
                    payloadSource = JSON.parse(decrypted);
                } catch (err) {
                    // If decrypt or parse fails, fallback to original response
                    console.warn('[fetchOnlineDatabaseData] Failed to decrypt/parse payload, falling back to response.data', err);
                    payloadSource = response.data;
                }
            }

            const sanitized = LicenceManagementModel.sanitizeFrontendResponse(payloadSource);
            const normalizedData = this.normalizeOnlineDatabaseResponse(sanitized);
            await this.saveFetchedOnlineConfig(normalizedData);
            const dbConfig = await prisma.db_config.findFirst({
                where: { is_active: true },
                orderBy: { updated_at: 'desc' }
            });

            return dbConfig;
        } catch (error) {
            // Extract error message from API response
            if (error.response && error.response.data) {
                const responseData = error.response.data;
                const statusCode = error.response.status;
                
                // Check if it's a 404 - customer doesn't have online DB configured
                if (statusCode === 404) {
                    const err = new Error(
                        'Online database not configured for this account. ' +
                        'Please contact support to enable online database access or contact your account administrator.'
                    );
                    err.statusCode = 404;
                    err.code = 'NO_ONLINE_DB_CONFIGURED';
                    err.response = error.response;
                    throw err;
                }
                
                // Check if unauthorized
                if (statusCode === 401) {
                    const err = new Error(
                        'Authentication failed. Please log in again and verify your OTP.'
                    );
                    err.statusCode = 401;
                    err.code = 'UNAUTHORIZED';
                    err.response = error.response;
                    throw err;
                }
                
                const errorMessage = responseData.message || 
                                   (responseData.error && responseData.error.message) || 
                                   'Failed to fetch online database configuration';
                
                const apiError = new Error(errorMessage);
                apiError.statusCode = statusCode;
                apiError.response = error.response;
                throw apiError;
            }
            
            // Network error
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                const err = new Error(
                    'Unable to reach the subscription server. Please check your internet connection.'
                );
                err.statusCode = 503;
                err.code = 'NETWORK_ERROR';
                throw err;
            }
            
            throw error;
        }
    },

    async getDbConfig() {
        return this.getActiveConfig();
    },

    /**
     * Get active database configuration
     */
    async getActiveConfig() {
        const config = await prisma.db_config.findFirst({
            where: { is_active: true },
            orderBy: { updated_at: 'desc' }
        });

        if (config && config.password) {
            try {
                config.password = decrypt(config.password);
            } catch (error) {
                console.error('Failed to decrypt password:', error);
            }
        }

        return config;
    },

    /**
     * Get all configurations
     */
    async getAllConfigs() {
        const configs = await prisma.db_config.findMany({
            orderBy: { updated_at: 'desc' }
        });

        // Decrypt passwords
        return configs.map(config => ({
            ...config,
            password: config.password ? '*'.repeat(8) : '' // Mask passwords in list view
        }));
    },

    /**
     * Get configuration by ID
     */
    async getConfigById(id) {
        const config = await prisma.db_config.findUnique({
            where: { id: parseInt(id) }
        });

        if (config && config.password) {
            try {
                config.password = decrypt(config.password);
            } catch (error) {
                console.error('Failed to decrypt password:', error);
            }
        }

        return config;
    },

    /**
     * Create new database configuration
     */
    async createConfig(data) {
        // Encrypt password
        const encryptedPassword = encrypt(data.password);

        // If this is set as active, deactivate all others
        if (data.is_active) {
            await prisma.db_config.updateMany({
                where: { is_active: true },
                data: { is_active: false }
            });
        }

        const config = await prisma.db_config.create({
            data: {
                host: data.host,
                user: data.user,
                password: encryptedPassword,
                database: data.database,
                port: data.port || '3306',
                is_active: data.is_active || false,
                mode: data.mode || 'offline'
            }
        });

        return config;
    },

    /**
     * Update database configuration
     */
    async updateConfig(id, data) {
        const updateData = {
            ...data,
            updated_at: new Date()
        };

        // Encrypt password if provided
        if (data.password) {
            updateData.password = encrypt(data.password);
        }

        // If setting as active, deactivate all others
        if (data.is_active) {
            await prisma.db_config.updateMany({
                where: { 
                    is_active: true,
                    id: { not: parseInt(id) }
                },
                data: { is_active: false }
            });
        }

        const config = await prisma.db_config.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        return config;
    },

    /**
     * Switch active mode (online/offline)
     */
    async switchMode(mode, deviceId = '') {
        let activeConfig = await this.getActiveConfig();

        // Ensure subscription allows online DB before attempting to switch to online
        if (mode === 'online') {
            const subscription = await subscriptionLocalModel.getSubscriptionLocal();
            if (!subscription || String(subscription.db_type || '').toLowerCase() !== 'online') {
                const err = new Error(
                    'Subscription does not permit switching to online mode. Please contact your account administrator.'
                );
                err.code = 'SUBSCRIPTION_DB_TYPE_OFFLINE';
                err.statusCode = 403;
                throw err;
            }
        }

        // If online is requested and local db_config is missing, attempt to fetch it first.
        if (!activeConfig && mode === 'online') {
            console.log('📥 [switchMode] No local config found, fetching online database details...');
            await this.fetchOnlineDatabaseData(deviceId);
            activeConfig = await this.getActiveConfig();
        }
        
        if (!activeConfig) {
            const err = new Error(
                'No database configuration found. ' +
                'Please ensure your license is validated and online database is configured.'
            );
            err.code = 'NO_CONFIG_FOUND';
            err.statusCode = 400;
            throw err;
        }

        // If an active row exists but required fields are missing, refresh from server and retry.
        if (
            mode === 'online' &&
            (!activeConfig.host || !activeConfig.user || !activeConfig.password || !activeConfig.database)
        ) {
            console.log('🔄 [switchMode] Config missing fields, refreshing from server...');
            await this.fetchOnlineDatabaseData(deviceId);
            activeConfig = await this.getActiveConfig();

            if (!activeConfig || !activeConfig.host || !activeConfig.user || !activeConfig.password || !activeConfig.database) {
                const err = new Error(
                    'Online database configuration is incomplete. ' +
                    'Please verify your account settings or contact support.'
                );
                err.code = 'INCOMPLETE_CONFIG';
                err.statusCode = 400;
                throw err;
            }
        }

        const updated = await prisma.db_config.update({
            where: { id: activeConfig.id },
            data: { 
                mode,
                updated_at: new Date()
            }
        });

        console.log(`✅ [switchMode] Mode updated to: ${mode}`);
        return updated;
    },

    /**
     * Get current mode
     */
    async getCurrentMode() {
        const activeConfig = await this.getActiveConfig();
        return activeConfig ? activeConfig.mode : 'offline';
    },

    /**
     * Delete configuration
     */
    async deleteConfig(id) {
        return await prisma.db_config.delete({
            where: { id: parseInt(id) }
        });
    }
};

module.exports = dbConfigModel;
