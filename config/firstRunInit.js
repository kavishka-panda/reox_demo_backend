const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const mysqlManager = require('./mysqlManager');

require('dotenv').config();

/**
 * First-run initialization script
 * This runs only once when the app is first installed
 * It:
 * 1. Creates the MySQL database if it doesn't exist
 * 2. Runs Prisma DB push to create tables
 * 3. Seeds the database with initial data
 */
async function performFirstRunInit(appDataPath) {
    const initFlagPath = path.join(appDataPath, '.initialized');

    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
    }

    // Check if already initialized
    if (fs.existsSync(initFlagPath)) {
        console.log('✅ App already initialized, skipping first-run setup');
        return { alreadyInitialized: true };
    }

    console.log('🚀 First run detected - Starting initialization...');
    console.log('═══════════════════════════════════════════════════');

    let connection = null;

    try {
        // Step 1: Ensure MySQL is available (check, start, or install if needed)
        console.log('\n📡 Step 1: Checking MySQL availability...');
        const mysqlAvailability = await mysqlManager.ensureMySQLAvailable(appDataPath);

        if (!mysqlAvailability.available) {
            console.error('❌ MySQL is not available');

            if (mysqlAvailability.needsManualInstall) {
                throw new Error(
                    'MySQL is not installed.\n\n' +
                    'Please install MySQL manually:\n' +
                    '1. Download MySQL Installer from https://dev.mysql.com/downloads/installer/\n' +
                    '2. Run the installer and choose "Server only" or "Developer Default"\n' +
                    '3. Complete the setup and restart this application\n\n' +
                    'Or install via command line: winget install Oracle.MySQL'
                );
            }

            throw new Error(mysqlAvailability.message || 'MySQL is not available');
        }

        console.log(`✅ MySQL is available (Type: ${mysqlAvailability.type}, Running: ${mysqlAvailability.running})`);

        // Give MySQL a moment to fully start if it was just started
        if (mysqlAvailability.started) {
            console.log('⏳ Waiting for MySQL to fully initialize...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Step 2: Connect to MySQL server (without selecting database)
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD;
        const dbName = process.env.DB_NAME || 'reox_db';
        const dbPort = parseInt(process.env.DB_PORT) || 3306;

        console.log('\n📡 Step 2: Connecting to MySQL server...');
        console.log(`   Host: ${dbHost}:${dbPort}`);
        console.log(`   User: ${dbUser}`);

        try {
            connection = await mysql.createConnection({
                host: dbHost,
                user: dbUser,
                password: dbPassword,
                port: dbPort
            });
            console.log('✅ Connected to MySQL server successfully');
        } catch (error) {
            console.error('❌ Failed to connect to MySQL server');
            console.error('   Error:', error.message);
            console.error('\n⚠️  Please ensure:');
            console.error('   1. MySQL server is installed and running');
            console.error('   2. The credentials in .env file are correct');
            console.error('   3. MySQL service is started (check Services or run "net start MySQL")');
            throw new Error('MySQL server connection failed: ' + error.message);
        }

        // Step 3: Create database if it doesn't exist
        console.log(`\n🗄️  Step 3: Creating database "${dbName}" if it doesn't exist...`);

        try {
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
            console.log(`✅ Database "${dbName}" created or already exists`);
        } catch (error) {
            console.error('❌ Failed to create database');
            console.error('   Error:', error.message);
            throw error;
        }

        // Close initial connection
        await connection.end();

        // Step 4: Run Prisma DB push to create tables
        console.log('\n🔨 Step 4: Creating database tables with Prisma...');
        console.log('   This may take a minute...');

        const backendPath = path.join(__dirname, '..');
        const databaseUrl = `mysql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;

        try {
            const { stdout, stderr } = await execPromise('npx prisma db push --accept-data-loss --skip-generate', {
                cwd: backendPath,
                env: {
                    ...process.env,
                    DATABASE_URL: databaseUrl
                }
            });

            if (stdout) console.log(stdout);
            if (stderr) console.warn('   Warnings:', stderr);
            console.log('✅ Database tables created successfully');
        } catch (error) {
            console.error('❌ Prisma DB push failed');
            console.error('   Error:', error.message);
            if (error.stdout) console.log('   Output:', error.stdout);
            if (error.stderr) console.error('   Stderr:', error.stderr);
            throw error;
        }

        // Step 5: Generate Prisma Client
        console.log('\n🔧 Step 5: Generating Prisma Client...');

        try {
            const { stdout, stderr } = await execPromise('npx prisma generate', {
                cwd: backendPath,
                env: {
                    ...process.env,
                    DATABASE_URL: databaseUrl
                }
            });

            if (stdout) console.log(stdout);
            if (stderr) console.warn('   Warnings:', stderr);
            console.log('✅ Prisma Client generated successfully');
        } catch (error) {
            console.error('❌ Prisma generate failed');
            console.error('   Error:', error.message);
            // Don't throw here, we can try to continue
        }

        // Step 6: Seed database with initial data
        console.log('\n🌱 Step 6: Seeding database with initial data...');

        const seedPath = path.join(backendPath, 'prisma', 'seed.js');

        if (fs.existsSync(seedPath)) {
            try {
                const { stdout, stderr } = await execPromise('node prisma/seed.js', {
                    cwd: backendPath,
                    env: {
                        ...process.env,
                        DATABASE_URL: databaseUrl
                    }
                });

                if (stdout) console.log(stdout);
                if (stderr) console.warn('   Warnings:', stderr);
                console.log('✅ Database seeded successfully');
            } catch (error) {
                console.error('⚠️  Database seeding encountered issues');
                console.error('   Error:', error.message);
                // Don't throw, seeding might partially succeed
            }
        } else {
            console.log('⚠️  Seed file not found, skipping seeding');
        }

        // Step 7: Mark as initialized
        console.log('\n📝 Step 7: Marking initialization as complete...');
        fs.writeFileSync(initFlagPath, JSON.stringify({
            initialized: true,
            timestamp: new Date().toISOString(),
            dbName: dbName,
            version: '1.0.0'
        }, null, 2));
        console.log('✅ Initialization flag created');

        console.log('\n═══════════════════════════════════════════════════');
        console.log('🎉 First-run initialization completed successfully!');
        console.log('═══════════════════════════════════════════════════\n');

        return {
            success: true,
            message: 'First-run initialization completed successfully'
        };

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════');
        console.error('❌ First-run initialization FAILED');
        console.error('═══════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.error('\nThe application will attempt to start, but may not work correctly.');
        console.error('Please check the error messages above and fix any issues.\n');

        // Clean up connection if still open
        if (connection) {
            try {
                await connection.end();
            } catch (e) {
                // Ignore
            }
        }

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Reset initialization flag (for testing or reinstall)
 */
function resetInitialization(appDataPath) {
    const initFlagPath = path.join(appDataPath, '.initialized');

    if (fs.existsSync(initFlagPath)) {
        fs.unlinkSync(initFlagPath);
        console.log('✅ Initialization flag removed');
        return true;
    }

    console.log('⚠️  No initialization flag found');
    return false;
}

/**
 * Check if initialization has been performed
 */
function isInitialized(appDataPath) {
    const initFlagPath = path.join(appDataPath, '.initialized');
    return fs.existsSync(initFlagPath);
}

module.exports = {
    performFirstRunInit,
    resetInitialization,
    isInitialized
};
