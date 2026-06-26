const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dbOnlineCheckModel = require('../models/dbOnlineCheckModel');
const dbConfigModel = require('../models/dbConfigModel');
require('dotenv').config();

/**
 * Initialize database connection by checking db_config table
 */
async function initializeDatabase() {
    let connection = null;
    
    try {
        // Step 1: Connect to local database to check db_config table
        const localConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT)
        };

        console.log('🔍 Connecting to local database to check configuration...');
        connection = await mysql.createConnection(localConfig);

        // Step 2: Resolve active configuration via model path used by controller
        const activeConfig = await dbConfigModel.getDbConfig();

        if (activeConfig) {
            console.log(`📋 Found active database configuration (ID: ${activeConfig.id})`);

            const syncAllowed = await dbOnlineCheckModel.isOnlineDbType();

            process.env.CURRENT_DB_MODE = syncAllowed ? 'online' : 'offline';
            process.env.CURRENT_DB_HOST = localConfig.host;
            process.env.CURRENT_DB_USER = localConfig.user;
            process.env.CURRENT_DB_PASSWORD = localConfig.password;
            process.env.CURRENT_DB_NAME = localConfig.database;
            process.env.CURRENT_DB_PORT = localConfig.port.toString();

            const localUrl = `mysql://${localConfig.user}:${encodeURIComponent(localConfig.password)}@${localConfig.host}:${localConfig.port}/${localConfig.database}`;
            process.env.DATABASE_URL = localUrl;

            if (syncAllowed) {
                console.log('🌐 Subscription db_type allows ONLINE sync');
                console.log(`   Online DB: ${activeConfig.host}:${activeConfig.port}/${activeConfig.database}`);
            } else {
                console.log('💾 Subscription db_type is OFFLINE');
            }

            console.log('✅ Local database initialized');
            console.log(`   Host: ${localConfig.host}`);
            console.log(`   Database: ${localConfig.database}`);

            await connection.end();
            return {
                mode: syncAllowed ? 'online' : 'offline',
                syncAllowed,
                config: {
                    host: activeConfig.host,
                    user: activeConfig.user,
                    password: activeConfig.password,
                    database: activeConfig.database,
                    port: activeConfig.port
                }
            };
        }

        process.env.CURRENT_DB_MODE = 'offline';
        process.env.CURRENT_DB_HOST = localConfig.host;
        process.env.CURRENT_DB_USER = localConfig.user;
        process.env.CURRENT_DB_PASSWORD = localConfig.password;
        process.env.CURRENT_DB_NAME = localConfig.database;
        process.env.CURRENT_DB_PORT = localConfig.port.toString();

        const localUrl = `mysql://${localConfig.user}:${encodeURIComponent(localConfig.password)}@${localConfig.host}:${localConfig.port}/${localConfig.database}`;
        process.env.DATABASE_URL = localUrl;

        console.log('⚠️  No active db_config found, using OFFLINE mode from .env file');

        await connection.end();
        return {
            mode: 'offline',
            config: localConfig
        };

    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        
        // Fallback to local config from .env
        const localConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'reox_pos',
            port: process.env.DB_PORT || '3306'
        };

        process.env.CURRENT_DB_MODE = 'offline';
        process.env.CURRENT_DB_HOST = localConfig.host;
        process.env.CURRENT_DB_USER = localConfig.user;
        process.env.CURRENT_DB_PASSWORD = localConfig.password;
        process.env.CURRENT_DB_NAME = localConfig.database;
        process.env.CURRENT_DB_PORT = localConfig.port;

        const localUrl = `mysql://${localConfig.user}:${encodeURIComponent(localConfig.password)}@${localConfig.host}:${localConfig.port}/${localConfig.database}`;
        process.env.DATABASE_URL = localUrl;

        console.log('⚠️  Falling back to OFFLINE mode from .env file');
        
        if (connection) {
            await connection.end();
        }

        return {
            mode: 'offline',
            config: localConfig
        };
    }
}

module.exports = { initializeDatabase };
