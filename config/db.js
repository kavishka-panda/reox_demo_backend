const mysql = require('mysql2');
require('dotenv').config();

class DatabaseConnectionManager {
    constructor() {
        this.currentPool = null;
        this.promisePool = null; // Store the promise pool directly
        this.currentMode = 'offline';
        this.initializeConnection();
    }

    /**
     * Initialize connection to LOCAL database
     * NOTE: This connection NEVER switches - it always stays on local DB
     */
    initializeConnection() {
        // ALWAYS connect to LOCAL database (from .env)
        const dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT),
            waitForConnections: true,
            connectionLimit: 20, // Increased for better performance
            queueLimit: 0
        };

        // Read mode from db_config table if available (for display only)
        this.currentMode = process.env.CURRENT_DB_MODE || 'offline';
        
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 MySQL2 Connection Pool (LOCAL DB ONLY)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Host: ${dbConfig.host}`);
        console.log(`Database: ${dbConfig.database}`);
        console.log(`User: ${dbConfig.user}`);
        console.log(`Port: ${dbConfig.port}`);
        console.log(`Pool Size: ${dbConfig.connectionLimit} connections`);
        console.log(`Note: This connection ALWAYS stays on local DB`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        this.currentPool = mysql.createPool(dbConfig);

        // Ensure DB-generated timestamps (CURRENT_TIMESTAMP/NOW) use server system timezone.
        this.currentPool.on('connection', (connection) => {
            connection.query("SET time_zone = 'SYSTEM'", (err) => {
                if (err) {
                    console.warn('⚠️  Failed to set MySQL session time_zone to SYSTEM:', err.message);
                }
            });
        });

        this.promisePool = this.currentPool.promise(); // Store promise pool
        
        // Test connection
        this.promisePool.query('SELECT 1')
            .then(() => console.log('✅ MySQL2 connection pool is ready'))
            .catch(err => {
                console.warn('⚠️  Database connection test failed:', err.message);
            });
    }

    /**
     * Update mode tracking (for display/logging purposes only)
     * NOTE: This does NOT switch the database connection!
     * The MySQL2 pool ALWAYS stays connected to LOCAL database.
    * Pending records are synced by BackgroundSyncWorker.
     */
    setMode(mode) {
        const oldMode = this.currentMode;
        this.currentMode = mode;
        
        if (oldMode !== mode) {
            console.log(`\n🔄 [MySQL2] Mode changed to: ${mode.toUpperCase()}`);
            console.log(`   Note: MySQL2 pool remains connected to LOCAL database`);
            console.log(`   ${mode === 'online' ? 'ONLINE sync handled by BackgroundSyncWorker' : 'OFFLINE mode - no sync'}\n`);
        }
    }

    getPool() {
        return this.promisePool; // Return stored promise pool
    }

    getCurrentMode() {
        return this.currentMode;
    }
}

// Create singleton instance
const dbManager = new DatabaseConnectionManager();

// Create a Proxy that dynamically forwards all calls to the current active pool
// This ensures that when we switch connections, all code automatically uses the new pool
const dynamicPoolProxy = new Proxy({}, {
    get(target, prop) {
        // Special handling for dbManager access
        if (prop === 'dbManager') {
            return dbManager;
        }
        
        // Get the current active pool
        const currentPool = dbManager.getPool();
        const value = currentPool[prop];
        
        // If it's a function, bind it to the current pool
        if (typeof value === 'function') {
            return function(...args) {
                // Log database operations for debugging (only for query/execute)
                if ((prop === 'query' || prop === 'execute') && args[0]) {
                    const mode = dbManager.getCurrentMode();
                    const queryPreview = args[0].substring(0, 100);
                    console.log(`[DB-${mode.toUpperCase()}] ${queryPreview}${args[0].length > 100 ? '...' : ''}`);
                }
                return value.apply(currentPool, args);
            };
        }
        
        return value;
    },
    
    set(target, prop, value) {
        const currentPool = dbManager.getPool();
        currentPool[prop] = value;
        return true;
    }
});

// Export the dynamic proxy that always uses the current active pool
module.exports = dynamicPoolProxy;
