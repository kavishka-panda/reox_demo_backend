const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const router = express.Router();

router.get('/check-env', async (req, res) => {
    const envPath = path.join(__dirname, '../.env');

    if (!fs.existsSync(envPath)) {
        return res.json({ exists: false, connected: false });
    }

    try {
        require('dotenv').config({ path: envPath });
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        await connection.end();
        res.json({ exists: true, connected: true });
    } catch (error) {
        res.json({ exists: true, connected: false });
    }
});

router.post('/test-connection', async (req, res) => {
    let { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, PORT, DB_PORT } = req.body;

    // Default DB_PORT to 3306 if not provided or empty
    if (!DB_PORT) DB_PORT = '3306';
    // Default DB_HOST to localhost if not provided or empty
    if (!DB_HOST) DB_HOST = 'localhost';
    
    // Default DB_NAME/USER if completely missing (safety net)
    if (!DB_USER) DB_USER = 'root';
    if (!DB_NAME) DB_NAME = 'reox_pos';

    try {
        const connectionConfig = {
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            port: parseInt(DB_PORT)
        };
        
        // Only add database if name is provided, to allow connection test to succeed even if DB doesn't exist yet (Prisma will create it)
        if (DB_NAME) {
            // Check if we can connect without DB first to distinguish auth vs db missing errors? 
            // Simplified: Try connecting with DB name. If it fails with 'Unknown database', we can proceed assuming Prisma creates it.
            // For now, let's stick to the user's flow. If they provide a name, we try to use it. 
            // Actually, for setup, we often want to create the DB. 
            // Let's rely on Prisma to create the DB. We just test credentials here.
            // connectionConfig.database = DB_NAME; // Commented out to allow DB creation by Prisma
        }

        // Test connection (without selecting DB to ensure credentials work even if DB missing)
        const connection = await mysql.createConnection(connectionConfig);
        await connection.end();

        // Construct DATABASE_URL for Prisma
        const encodedPassword = encodeURIComponent(DB_PASSWORD);
        const databaseUrl = `mysql://${DB_USER}:${encodedPassword}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

        // Ensure PORT defaults to 5000 if missing for .env file
        const APP_PORT = PORT || '5000';

        const envContent = `DB_HOST=${DB_HOST}\nDB_USER=${DB_USER}\nDB_PASSWORD='${DB_PASSWORD}'\nDB_NAME=${DB_NAME}\nPORT=${APP_PORT}\nDATABASE_URL="${databaseUrl}"`;
        const envPath = path.join(__dirname, '../.env');
        fs.writeFileSync(envPath, envContent);

        // Reload environment variables in current process
        delete require.cache[require.resolve('dotenv')];
        require('dotenv').config();

        // Run Prisma DB Push and Seed
        const { exec } = require('child_process');
        const projectRoot = path.join(__dirname, '..');

        // Command to run prisma db push and then seed
        const command = `npx prisma db push --accept-data-loss && node prisma/seed.js`;

        console.log(`Executing command: ${command} in ${projectRoot}`);
        console.log(`Using DATABASE_URL: ${databaseUrl}`);

        exec(command, { 
            cwd: projectRoot,
            // Explicitly pass the DATABASE_URL to ensure the child process uses the correct one immediately
            env: { ...process.env, DATABASE_URL: databaseUrl } 
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec error: ${error}`);
                console.error(`Stderr: ${stderr}`);
                return res.json({ success: false, message: `Database setup failed during table generation/seeding. Check server logs. Error: ${error.message}` });
            }
            console.log(`Stdout: ${stdout}`);
            if (stderr) console.warn(`Stderr (warning): ${stderr}`);

            res.json({ success: true, message: 'Database configured, tables created, and seeded successfully! Please manually restart the server if the application does not reconnect automatically.' });
        });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});



// Test online database connection (without saving)
router.post('/test-online-connection', async (req, res) => {
    const { host, user, password, database, port } = req.body;

    if (!host || !user || !database) {
        return res.json({ success: false, message: 'Host, user, and database are required' });
    }

    try {
        const connectionConfig = {
            host,
            user,
            password,
            database,
            port: parseInt(port || '3306')
        };

        const connection = await mysql.createConnection(connectionConfig);
        await connection.query('SELECT 1'); // Test query
        await connection.end();

        res.json({ success: true, message: 'Online database connection successful!' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Save online database configuration
router.post('/save-online-config', async (req, res) => {
    const { host, user, password, database, port } = req.body;

    if (!host || !user || !database) {
        return res.json({ success: false, message: 'Host, user, and database are required' });
    }

    try {
        const onlineConfigPath = path.join(__dirname, '../.env.online');
        const encodedPassword = encodeURIComponent(password);
        const onlineDbUrl = `mysql://${user}:${encodedPassword}@${host}:${port || 3306}/${database}`;

        const onlineEnvContent = `ONLINE_DB_HOST=${host}
ONLINE_DB_USER=${user}
ONLINE_DB_PASSWORD='${password}'
ONLINE_DB_NAME=${database}
ONLINE_DB_PORT=${port || 3306}
ONLINE_DATABASE_URL="${onlineDbUrl}"`;

        fs.writeFileSync(onlineConfigPath, onlineEnvContent);

        res.json({ success: true, message: 'Online database configuration saved successfully!' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Get current database mode
router.get('/current-mode', async (req, res) => {
    try {
        // Read mode from database (source of truth)
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'reox_pos',
            port: parseInt(process.env.DB_PORT) || 3306
        });

        const [rows] = await connection.execute(
            'SELECT mode FROM db_config WHERE is_active = ? ORDER BY updated_at DESC LIMIT 1',
            [1]
        );

        await connection.end();

        if (rows && rows.length > 0) {
            res.json({ mode: rows[0].mode });
        } else {
            // No active config, default to offline
            res.json({ mode: 'offline' });
        }
    } catch (error) {
        console.error('Error getting current mode:', error);
        res.json({ mode: 'offline' });
    }
});

// Switch database mode
router.post('/switch-mode', async (req, res) => {
    const { mode } = req.body;

    if (mode !== 'online' && mode !== 'offline') {
        return res.json({ success: false, message: 'Invalid mode. Must be "online" or "offline"' });
    }

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'reox_pos',
            port: parseInt(process.env.DB_PORT) || 3306
        });

        // Check if active config exists
        const [rows] = await connection.execute(
            'SELECT * FROM db_config WHERE is_active = ? ORDER BY updated_at DESC LIMIT 1',
            [1]
        );

        if (!rows || rows.length === 0) {
            await connection.end();
            return res.json({ success: false, message: 'No active database configuration found. Please configure online database first.' });
        }

        // Update mode in database (source of truth)
        await connection.execute(
            'UPDATE db_config SET mode = ?, updated_at = NOW() WHERE is_active = ?',
            [mode, 1]
        );

        // Update runtime environment variable (instant effect)
        process.env.CURRENT_DB_MODE = mode;

        await connection.end();

        // Start or stop the sync worker based on mode
        const { setSyncMode } = require('../middleware/syncMiddleware');
        await setSyncMode(mode);

        res.json({ success: true, message: `Switched to ${mode} mode successfully! Sync worker ${mode === 'online' ? 'started' : 'stopped'}.` });
    } catch (error) {
        if (connection) await connection.end();
        console.error('Error switching mode:', error);
        res.json({ success: false, message: error.message });
    }
});

// Check internet connectivity
router.get('/check-internet', async (req, res) => {
    const https = require('https');
    const http = require('http');
    const startTime = Date.now();

    // Function to check a single host
    const checkHost = (url, timeout = 5000) => {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            const request = protocol.get(url, { timeout }, (response) => {
                resolve(true);
                response.resume(); // Consume response data to free up memory
            });

            request.on('error', () => resolve(false));
            request.on('timeout', () => {
                request.destroy();
                resolve(false);
            });
        });
    };

    try {
        // Try multiple reliable hosts
        const hosts = [
            'https://www.google.com',
            'https://www.cloudflare.com',
            'https://www.github.com'
        ];

        // Check first host (fastest response)
        for (const host of hosts) {
            const isReachable = await checkHost(host, 3000);
            if (isReachable) {
                const latency = Date.now() - startTime;
                
                let status;
                if (latency < 100) status = 'excellent';
                else if (latency < 300) status = 'good';
                else status = 'poor';

                return res.json({
                    isOnline: true,
                    latency,
                    status,
                    lastChecked: new Date()
                });
            }
        }

        // All hosts failed
        res.json({
            isOnline: false,
            latency: null,
            status: 'offline',
            lastChecked: new Date()
        });
    } catch (error) {
        res.json({
            isOnline: false,
            latency: null,
            status: 'offline',
            lastChecked: new Date()
        });
    }
});

module.exports = router;
