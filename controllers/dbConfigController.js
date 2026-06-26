const dbConfigModel = require('../models/dbConfigModel');
const mysql = require('mysql2/promise');
const { setSyncMode } = require('../middleware/syncMiddleware');

const dbConfigController = {
    /**
     * Get all database configurations
     */
    async getAllConfigs(req, res) {
        try {
            const configs = await dbConfigModel.getAllConfigs();
            res.json({ success: true, data: configs });
        } catch (error) {
            console.error('Error fetching configs:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get active configuration
     */
    async getActiveConfig(req, res) {
        try {
            const config = await dbConfigModel.getActiveConfig();
            res.json({ success: true, data: config });
        } catch (error) {
            console.error('Error fetching active config:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get configuration by ID
     */
    async getConfigById(req, res) {
        try {
            const config = await dbConfigModel.getConfigById(req.params.id);
            if (!config) {
                return res.status(404).json({ success: false, message: 'Configuration not found' });
            }
            res.json({ success: true, data: config });
        } catch (error) {
            console.error('Error fetching config:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Test database connection before saving
     */
    async testConnection(req, res) {
        try {
            const { host, user, password, database, port } = req.body;

            const connection = await mysql.createConnection({
                host: host || 'localhost',
                user,
                password,
                database,
                port: parseInt(port) || 3306,
                connectTimeout: 10000
            });

            await connection.ping();
            await connection.end();

            res.json({ 
                success: true, 
                message: 'Connection successful! Database is reachable.' 
            });
        } catch (error) {
            console.error('Connection test failed:', error);
            res.json({ 
                success: false, 
                message: `Connection failed: ${error.message}` 
            });
        }
    },

    /**
     * Create new database configuration
     */
    async createConfig(req, res) {
        try {
            const { host, user, password, database, port, is_active, mode } = req.body;

            // Validate required fields
            if (!host || !user || !password || !database) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Missing required fields: host, user, password, database' 
                });
            }

            // Test connection first
            try {
                const connection = await mysql.createConnection({
                    host,
                    user,
                    password,
                    database,
                    port: parseInt(port) || 3306,
                    connectTimeout: 10000
                });
                await connection.ping();
                await connection.end();
            } catch (error) {
                return res.json({ 
                    success: false, 
                    message: `Connection test failed: ${error.message}` 
                });
            }

            const config = await dbConfigModel.createConfig({
                host,
                user,
                password,
                database,
                port: port || '3306',
                is_active: is_active || false,
                mode: mode || 'offline'
            });

            res.json({ 
                success: true, 
                message: 'Database configuration saved successfully!',
                data: config
            });
        } catch (error) {
            console.error('Error creating config:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Update database configuration
     */
    async updateConfig(req, res) {
        try {
            const { id } = req.params;
            const { host, user, password, database, port, is_active, mode } = req.body;

            // Test connection if connection details are provided
            if (host && user && password && database) {
                try {
                    const connection = await mysql.createConnection({
                        host,
                        user,
                        password,
                        database,
                        port: parseInt(port) || 3306,
                        connectTimeout: 10000
                    });
                    await connection.ping();
                    await connection.end();
                } catch (error) {
                    return res.json({ 
                        success: false, 
                        message: `Connection test failed: ${error.message}` 
                    });
                }
            }

            const config = await dbConfigModel.updateConfig(id, {
                host,
                user,
                password,
                database,
                port,
                is_active,
                mode
            });

            res.json({ 
                success: true, 
                message: 'Configuration updated successfully!',
                data: config
            });
        } catch (error) {
            console.error('Error updating config:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Switch database mode (online/offline)
     * 
     * ARCHITECTURE:
     * - LOCAL DB is ALWAYS connected (never switch the main connection)
     * - ONLINE mode: Enables dual-write (writes to LOCAL first, syncs to ONLINE in background)
     * - OFFLINE mode: Disables dual-write (writes to LOCAL only, marks as 'pending')
     */
    async switchMode(req, res) {
        try {
            const { mode } = req.body;

            if (!mode || !['online', 'offline'].includes(mode)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid mode. Must be "online" or "offline"' 
                });
            }

            console.log(`\n🔄 [SwitchMode] Switching to ${mode.toUpperCase()} mode...`);

            const deviceId = req.headers['device-id'] || req.query.device_id || '';

            // Update mode in database (local db_config table)
            await dbConfigModel.switchMode(mode, deviceId);
            console.log(`✅ [SwitchMode] Mode updated in db_config table`);

            // Enable/disable dual-write and background sync
            // NOTE: LOCAL DB remains connected - we're just toggling sync behavior
            await setSyncMode(mode);

            if (mode === 'online') {
                console.log(`✅ [SwitchMode] ONLINE mode enabled:`);
                console.log(`   - LOCAL DB: Primary (all writes go here first)`);
                console.log(`   - ONLINE DB: Sync target (receives data in background)`);
                console.log(`   - Pending records will sync automatically`);
                
                res.json({ 
                    success: true, 
                    message: `Online mode enabled! Data is now written to local database first and synced to cloud in background.`,
                    mode: mode
                });
            } else {
                console.log(`✅ [SwitchMode] OFFLINE mode enabled:`);
                console.log(`   - LOCAL DB: Primary (all writes go here)`);
                console.log(`   - ONLINE DB: Disabled (no sync)`);
                console.log(`   - New records marked as 'pending' for later sync`);
                
                res.json({ 
                    success: true, 
                    message: `Offline mode enabled! Data is stored locally and marked for sync when online.`,
                    mode: mode
                });
            }
        } catch (error) {
            console.error('❌ [SwitchMode] Error switching mode:', error);

            // Extract error message and determine appropriate status code
            let errorMessage = 'Failed to switch mode';
            let statusCode = 500;
            
            // Check for specific error codes
            if (error.code === 'NO_ONLINE_DB_CONFIGURED') {
                statusCode = 404;
                errorMessage = error.message;
                console.warn('⚠️  [SwitchMode] Online database not configured for this customer');
            } else if (error.code === 'UNAUTHORIZED') {
                statusCode = 401;
                errorMessage = error.message;
                console.warn('⚠️  [SwitchMode] Authentication failed');
            } else if (error.code === 'NETWORK_ERROR') {
                statusCode = 503;
                errorMessage = error.message;
                console.warn('⚠️  [SwitchMode] Network error reaching subscription server');
            } else if (error.statusCode) {
                statusCode = error.statusCode;
                errorMessage = error.message;
            } else if (error.response && error.response.data) {
                const responseData = error.response.data;
                statusCode = error.response.status || 500;
                
                if (responseData.message) {
                    errorMessage = responseData.message;
                } else if (responseData.error && responseData.error.message) {
                    errorMessage = responseData.error.message;
                } else if (typeof responseData === 'object') {
                    errorMessage = JSON.stringify(responseData);
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            res.status(statusCode).json({ 
                success: false, 
                message: errorMessage,
                code: error.code || 'UNKNOWN_ERROR'
            });
        }
    },

    /**
     * Get current mode
     */
    async getCurrentMode(req, res) {
        try {
            const mode = await dbConfigModel.getCurrentMode();
            res.json({ mode });
        } catch (error) {
            console.error('Error getting current mode:', error);
            res.json({ mode: 'offline' });
        }
    },

    /**
     * Delete configuration
     */
    async deleteConfig(req, res) {
        try {
            const { id } = req.params;
            await dbConfigModel.deleteConfig(id);
            res.json({ 
                success: true, 
                message: 'Configuration deleted successfully!' 
            });
        } catch (error) {
            console.error('Error deleting config:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Fetch online database config from server and save in db_config
     */
    async fetchOnlineDatabaseData(req, res) {
        try {
            const deviceId = req.headers['device-id'] || req.query.device_id || '';
            const data = await dbConfigModel.fetchOnlineDatabaseData(deviceId);
            res.json({
                success: true,
                message: 'Online database configuration fetched successfully!',
                data
            });
        } catch (error) {
            if (error.response && error.response.data) {
                const responseData = error.response.data;

                if (responseData.error && responseData.error.message) {
                    return res.status(500).json({ success: false, message: responseData.error.message });
                }

                return res.status(500).json({ success: false, message: responseData.message || JSON.stringify(responseData) });
            }

            console.error('Error in fetchOnlineDatabaseData:', error.message);
            res.status(500).json({
                success: false,
                    message: error.message || 'Failed to fetch online database configuration'
            });
        }
    },

    /**
     * Get active db config (password decrypted)
     */
    async getDbConfig(req, res) {
        try {
            const config = await dbConfigModel.getDbConfig();

            if (!config) {
                return res.status(404).json({
                    success: false,
                    message: 'No active database configuration found.'
                });
            }

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            console.error('Error in getDbConfig:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = dbConfigController;
