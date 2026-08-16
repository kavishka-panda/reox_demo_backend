const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dbOnlineCheckModel = require('../models/dbOnlineCheckModel');
const dbConfigModel = require('../models/dbConfigModel');

const packageJson = require('../package.json');
const CURRENT_VERSION = packageJson.version;

require('dotenv').config();

const roamingDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const statusFilePath = path.join(roamingDir, 'Reox', 'db_status.json');

const backendRoot = path.resolve(__dirname, '..');

function getPrismaSchemaPath() {
    const candidates = [
        path.join(backendRoot, 'prisma', 'schema.prisma'),
        path.join(backendRoot, '..', 'prisma', 'schema.prisma'),
        path.join(backendRoot, 'backend', 'prisma', 'schema.prisma')
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function runCommand(commandString) {
    try {
        console.log(`🏃 Running: ${commandString}...`);
        execSync(commandString, {
            stdio: 'inherit',
            cwd: backendRoot,
            shell: false
        });
        return true;
    } catch (error) {
        console.error(`❌ Error running command [${commandString}]:`, error.message);
        return false;
    }
}

async function initializeDatabase() {
    let connection = null;
    const localConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'reox_pos',
        port: parseInt(process.env.DB_PORT || '3306')
    };

    try {
        console.log('🔍 Connecting to local database...');

        const rootConnection = await mysql.createConnection({
            host: localConfig.host,
            user: localConfig.user,
            password: localConfig.password,
            port: localConfig.port
        });
        await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${localConfig.database}\`;`);
        await rootConnection.end();

        connection = await mysql.createConnection(localConfig);

        let needsSync = false;
        let installedVersion = null;

        if (fs.existsSync(statusFilePath)) {
            try {
                const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
                installedVersion = statusData.version;
            } catch (e) {
                needsSync = true; 
            }
        } else {
            needsSync = true;
        }

        if (installedVersion !== CURRENT_VERSION) {
            needsSync = true;
            console.log(`🔄 Software Update Detected! [V${installedVersion} -> V${CURRENT_VERSION}]`);
        }

        if (needsSync) {
            console.log('⚠️ Syncing database schema to match the current software version...');

            const schemaPath = getPrismaSchemaPath();
            const schemaArg = schemaPath ? `--schema "${schemaPath}"` : '';
            const pushSuccess = runCommand(`npx prisma db push ${schemaArg}`.trim());

            if (pushSuccess) {
                console.log('🌱 Checking/Running seed data...');
                runCommand(`npx prisma db seed ${schemaArg}`.trim());

                fs.mkdirSync(path.dirname(statusFilePath), { recursive: true });
                fs.writeFileSync(statusFilePath, JSON.stringify({
                    version: CURRENT_VERSION,
                    last_initialized: new Date().toISOString()
                }, null, 2));

                console.log(`✅ Database successfully configured for Version ${CURRENT_VERSION}`);
            }
        } else {
            console.log(`⚡ Database is up to date (V${CURRENT_VERSION}). Skipping Prisma sync for faster boot.`);
        }

        const activeConfig = await dbConfigModel.getDbConfig().catch(() => null);
        let syncAllowed = false;
        if (activeConfig) {
            syncAllowed = await dbOnlineCheckModel.isOnlineDbType().catch(() => false);
        }

        process.env.CURRENT_DB_MODE = syncAllowed ? 'online' : 'offline';
        process.env.CURRENT_DB_HOST = localConfig.host;
        process.env.CURRENT_DB_USER = localConfig.user;
        process.env.CURRENT_DB_PASSWORD = localConfig.password;
        process.env.CURRENT_DB_NAME = localConfig.database;
        process.env.CURRENT_DB_PORT = localConfig.port.toString();
        process.env.DATABASE_URL = `mysql://${localConfig.user}:${encodeURIComponent(localConfig.password)}@${localConfig.host}:${localConfig.port}/${localConfig.database}`;

        await connection.end();
        return { mode: syncAllowed ? 'online' : 'offline', syncAllowed, config: localConfig };

    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        if (connection) await connection.end();
        return { mode: 'offline', config: localConfig };
    }
}

module.exports = { initializeDatabase };