const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * MySQL Manager - Detects, installs, and manages MySQL server
 * Handles both installed MySQL and portable MySQL versions
 */

/**
 * Check if MySQL is installed and accessible
 */
async function checkMySQLInstalled() {
    const checks = [
        // Check common MySQL service names
        { command: 'sc query MySQL80', service: 'MySQL80' },
        { command: 'sc query MySQL', service: 'MySQL' },
        { command: 'sc query MariaDB', service: 'MariaDB' },

        // Check if mysql command is available
        { command: 'mysql --version', type: 'command' },

        // Check common installation paths
        { path: 'C:\\Program Files\\MySQL', type: 'path' },
        { path: 'C:\\Program Files (x86)\\MySQL', type: 'path' },
        { path: 'C:\\xampp\\mysql', type: 'path' },
    ];

    for (const check of checks) {
        try {
            if (check.command) {
                await execPromise(check.command);
                console.log(`✅ Found MySQL: ${check.service || check.type}`);
                return { installed: true, method: check.service || check.type };
            } else if (check.path && fs.existsSync(check.path)) {
                console.log(`✅ Found MySQL at: ${check.path}`);
                return { installed: true, method: 'path', location: check.path };
            }
        } catch (error) {
            // Continue checking
        }
    }

    console.log('❌ MySQL not found on system');
    return { installed: false };
}

/**
 * Test MySQL connection
 */
async function testMySQLConnection(host = 'localhost', port = 3306, user = 'root', password = '') {
    const mysql = require('mysql2/promise');

    try {
        const connection = await mysql.createConnection({
            host,
            port,
            user,
            password,
            connectTimeout: 5000
        });

        await connection.query('SELECT 1');
        await connection.end();

        console.log('✅ MySQL connection successful');
        return { connected: true };
    } catch (error) {
        console.log('❌ MySQL connection failed:', error.message);
        return { connected: false, error: error.message };
    }
}

function getLocalMySqlConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    };
}

/**
 * Try to start MySQL service if it exists but isn't running
 */
async function startMySQLService() {
    const services = ['MySQL80', 'MySQL', 'MariaDB'];

    for (const serviceName of services) {
        try {
            console.log(`🔄 Attempting to start ${serviceName} service...`);
            await execPromise(`net start ${serviceName}`);
            console.log(`✅ ${serviceName} service started successfully`);

            // Wait a bit for service to fully start
            await new Promise(resolve => setTimeout(resolve, 3000));

            return { started: true, service: serviceName };
        } catch (error) {
            // Service doesn't exist or failed to start, try next
            continue;
        }
    }

    console.log('❌ Could not start any MySQL service');
    return { started: false };
}

/**
 * Get path to bundled MySQL ZIP
 * In packaged app, it's in process.resourcesPath/binaries
 * In development, it's in project root/resources/binaries
 */
function getBundledMySQLPath() {
    const isPackaged = process.env.NODE_ENV === 'production' || process.resourcesPath;

    let bundledPath;
    if (isPackaged && process.resourcesPath) {
        // Production: MySQL is in resources/binaries
        bundledPath = path.join(process.resourcesPath, 'binaries');
    } else {
        // Development: MySQL is in project root/resources/binaries
        bundledPath = path.join(__dirname, '..', '..', 'resources', 'binaries');
    }

    console.log('🔍 Looking for bundled MySQL in:', bundledPath);

    // Check if directory exists
    if (!fs.existsSync(bundledPath)) {
        console.log('⚠️  Bundled MySQL directory not found');
        return null;
    }

    // Look for MySQL ZIP file (mysql-X.X.XX-winx64.zip - any version)
    const files = fs.readdirSync(bundledPath);
    const mysqlZip = files.find(f =>
        f.startsWith('mysql-') &&
        f.endsWith('-winx64.zip') &&
        /mysql-\d+\.\d+\.\d+-winx64\.zip/.test(f) // Match mysql-X.X.X-winx64.zip pattern
    );

    if (mysqlZip) {
        const fullPath = path.join(bundledPath, mysqlZip);
        console.log('✅ Found bundled MySQL:', mysqlZip);

        // Extract version for info
        const versionMatch = mysqlZip.match(/mysql-(\d+\.\d+\.\d+)-winx64\.zip/);
        if (versionMatch) {
            console.log('   Version:', versionMatch[1]);
        }

        return fullPath;
    }

    console.log('⚠️  No MySQL ZIP found in bundled resources');
    console.log('   Expected format: mysql-X.X.X-winx64.zip (e.g., mysql-8.0.36-winx64.zip or mysql-9.6.0-winx64.zip)');
    return null;
}

/**
 * Copy bundled MySQL ZIP to app data directory
 */
async function copyBundledMySQL(sourcePath, destinationPath) {
    console.log('📋 Copying bundled MySQL to app data...');
    console.log('   From:', sourcePath);
    console.log('   To:', destinationPath);

    return new Promise((resolve, reject) => {
        const totalSize = fs.statSync(sourcePath).size;
        let copiedSize = 0;
        let lastPercent = 0;

        const readStream = fs.createReadStream(sourcePath);
        const writeStream = fs.createWriteStream(destinationPath);

        readStream.on('data', (chunk) => {
            copiedSize += chunk.length;
            const percent = Math.floor((copiedSize / totalSize) * 100);
            if (percent >= lastPercent + 10) {
                console.log(`   Copied: ${percent}% (${Math.floor(copiedSize / 1024 / 1024)}MB / ${Math.floor(totalSize / 1024 / 1024)}MB)`);
                lastPercent = percent;
            }
        });

        readStream.on('error', (err) => {
            reject(err);
        });

        writeStream.on('error', (err) => {
            reject(err);
        });

        writeStream.on('finish', () => {
            console.log('✅ MySQL copied successfully');
            resolve();
        });

        readStream.pipe(writeStream);
    });
}

/**
 * Download MySQL portable/zip version
 * DEPRECATED: No longer used - MySQL is bundled with the app
 * Kept for reference only
 */
async function downloadMySQLPortable(downloadPath) {
    console.log('📥 Downloading MySQL portable version...');
    console.log('⚠️  This is a large download (~200MB) and may take several minutes');

    // MySQL 8.0 Windows ZIP (no-install version)
    // In production, you should bundle this with the app instead of downloading
    const mysqlUrl = 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.36-winx64.zip';

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(downloadPath);

        https.get(mysqlUrl, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    const totalSize = parseInt(redirectResponse.headers['content-length'], 10);
                    let downloadedSize = 0;
                    let lastPercent = 0;

                    redirectResponse.on('data', (chunk) => {
                        downloadedSize += chunk.length;
                        const percent = Math.floor((downloadedSize / totalSize) * 100);
                        if (percent >= lastPercent + 10) {
                            console.log(`   Downloaded: ${percent}% (${Math.floor(downloadedSize / 1024 / 1024)}MB / ${Math.floor(totalSize / 1024 / 1024)}MB)`);
                            lastPercent = percent;
                        }
                    });

                    redirectResponse.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        console.log('✅ MySQL downloaded successfully');
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlinkSync(downloadPath);
                    reject(err);
                });
            } else {
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const percent = Math.floor((downloadedSize / totalSize) * 100);
                    if (percent % 10 === 0) {
                        console.log(`   Downloaded: ${percent}%`);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    console.log('✅ MySQL downloaded successfully');
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlinkSync(downloadPath);
            reject(err);
        });
    });
}

/**
 * Extract ZIP file (MySQL portable)
 */
async function extractZip(zipPath, extractPath) {
    console.log('📦 Extracting MySQL...');

    // Use PowerShell to extract (built into Windows)
    const command = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`;

    try {
        await execPromise(command);
        console.log('✅ MySQL extracted successfully');
        return true;
    } catch (error) {
        console.error('❌ Extraction failed:', error.message);
        return false;
    }
}

/**
 * Setup portable MySQL configuration
 */
function setupMySQLConfig(mysqlPath, dataPath, port = 3306) {
    console.log('⚙️  Configuring MySQL...');

    const iniContent = `[mysqld]
# Basic settings
port=${port}
basedir=${mysqlPath.replace(/\\/g, '/')}
datadir=${dataPath.replace(/\\/g, '/')}

# Character set
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

# Security
skip-grant-tables
skip-networking=0
bind-address=127.0.0.1

# Performance
max_connections=100
max_allowed_packet=64M

# InnoDB settings
default-storage-engine=INNODB
innodb_buffer_pool_size=256M
innodb_log_file_size=64M
innodb_flush_method=normal

# Logging
log-error=${dataPath.replace(/\\/g, '/')}/error.log

[mysql]
default-character-set=utf8mb4

[client]
port=${port}
default-character-set=utf8mb4
`;

    const iniPath = path.join(mysqlPath, 'my.ini');
    fs.writeFileSync(iniPath, iniContent);
    console.log('✅ MySQL configuration created');

    return iniPath;
}

/**
 * Initialize MySQL data directory
 */
async function initializeMySQLData(mysqlPath, dataPath) {
    console.log('🔧 Initializing MySQL data directory...');
    console.log('   This may take a few minutes...');

    const mysqldPath = path.join(mysqlPath, 'bin', 'mysqld.exe');

    if (!fs.existsSync(mysqldPath)) {
        throw new Error(`mysqld.exe not found at: ${mysqldPath}`);
    }

    // Initialize data directory
    const initCommand = `"${mysqldPath}" --initialize-insecure --basedir="${mysqlPath}" --datadir="${dataPath}"`;

    try {
        const { stdout, stderr } = await execPromise(initCommand, {
            timeout: 120000 // 2 minutes timeout
        });
        if (stdout) console.log(stdout);
        if (stderr) console.log('   Info:', stderr);
        console.log('✅ MySQL data directory initialized');
        return true;
    } catch (error) {
        console.error('❌ MySQL initialization failed:', error.message);
        throw error;
    }
}

/**
 * Start portable MySQL server
 */
function startPortableMySQL(mysqlPath, configPath) {
    console.log('🚀 Starting MySQL server...');

    const mysqldPath = path.join(mysqlPath, 'bin', 'mysqld.exe');

    const mysqlProcess = spawn(mysqldPath, [
        `--defaults-file=${configPath}`,
        '--console'
    ], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    mysqlProcess.stdout.on('data', (data) => {
        console.log(`[MySQL]: ${data.toString().trim()}`);
    });

    mysqlProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('ready for connections') || msg.includes('mysqld: ready')) {
            console.log('✅ MySQL server started successfully');
        }
        console.log(`[MySQL]: ${msg}`);
    });

    mysqlProcess.on('error', (error) => {
        console.error('❌ MySQL process error:', error);
    });

    mysqlProcess.on('exit', (code) => {
        console.log(`MySQL process exited with code ${code}`);
    });

    return mysqlProcess;
}

/**
 * Complete MySQL installation and setup
 */
async function installAndSetupMySQL(appDataPath) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📦 MySQL NOT FOUND - Installing Portable MySQL');
    console.log('═══════════════════════════════════════════════════\n');

    try {
        // Step 1: Check for bundled MySQL ZIP
        const bundledMySQLPath = getBundledMySQLPath();

        if (!bundledMySQLPath) {
            console.log('\n⚠️  BUNDLED MYSQL NOT FOUND');
            console.log('═══════════════════════════════════════════════════');
            console.log('MySQL ZIP file was not found in the application bundle.');
            console.log('\nTo fix this, you need to:');
            console.log('1. Download MySQL 8.0 Windows ZIP (no-install) from:');
            console.log('   https://dev.mysql.com/downloads/mysql/');
            console.log('2. Place it in: resources/binaries/mysql-8.0.xx-winx64.zip');
            console.log('3. Rebuild the application');
            console.log('\nAlternatively, install MySQL manually:');
            console.log('- Download MySQL Installer from mysql.com');
            console.log('- Or run: winget install Oracle.MySQL');
            console.log('═══════════════════════════════════════════════════\n');

            return {
                success: false,
                needsManualInstall: true,
                message: 'MySQL ZIP not bundled with application. Please install MySQL manually or rebuild the app with MySQL included.'
            };
        }

        // Step 2: Create MySQL directory in app data
        const mysqlDir = path.join(appDataPath, 'mysql');
        const mysqlDataDir = path.join(mysqlDir, 'data');
        const mysqlZipPath = path.join(mysqlDir, 'mysql.zip');

        // Create directories
        if (!fs.existsSync(mysqlDir)) {
            fs.mkdirSync(mysqlDir, { recursive: true });
        }
        if (!fs.existsSync(mysqlDataDir)) {
            fs.mkdirSync(mysqlDataDir, { recursive: true });
        }

        console.log('📍 MySQL will be installed at:', mysqlDir);

        // Step 3: Copy bundled MySQL to app data
        if (!fs.existsSync(mysqlZipPath)) {
            await copyBundledMySQL(bundledMySQLPath, mysqlZipPath);
        } else {
            console.log('✅ MySQL ZIP already exists in app data');
        }

        // Step 4: Extract MySQL
        console.log('\n📦 Extracting MySQL (this may take a few minutes)...');
        const extractSuccess = await extractZip(mysqlZipPath, mysqlDir);

        if (!extractSuccess) {
            throw new Error('MySQL extraction failed');
        }

        // Step 5: Find extracted MySQL folder (usually mysql-8.0.xx-winx64)
        const extractedFolders = fs.readdirSync(mysqlDir).filter(f => {
            const fullPath = path.join(mysqlDir, f);
            return f.startsWith('mysql-') &&
                fs.statSync(fullPath).isDirectory() &&
                f !== 'data'; // Exclude our data directory
        });

        if (extractedFolders.length === 0) {
            throw new Error('MySQL extraction failed - no MySQL folder found after extraction');
        }

        const actualMySQLPath = path.join(mysqlDir, extractedFolders[0]);
        console.log('✅ MySQL extracted to:', actualMySQLPath);

        // Step 6: Setup configuration
        console.log('\n⚙️  Configuring MySQL...');
        const configPath = setupMySQLConfig(actualMySQLPath, mysqlDataDir);

        // Step 7: Initialize data directory
        console.log('\n🔧 Initializing MySQL data directory...');
        await initializeMySQLData(actualMySQLPath, mysqlDataDir);

        // Step 8: Start MySQL server
        console.log('\n🚀 Starting MySQL server...');
        const mysqlProcess = startPortableMySQL(actualMySQLPath, configPath);

        // Step 9: Wait for MySQL to be ready
        console.log('⏳ Waiting for MySQL to start...');
        await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds

        // Step 10: Test connection
        console.log('🔌 Testing MySQL connection...');
        let connectionAttempts = 0;
        let connected = false;

        while (connectionAttempts < 5 && !connected) {
            const testResult = await testMySQLConnection();
            if (testResult.connected) {
                connected = true;
                break;
            }
            connectionAttempts++;
            console.log(`   Attempt ${connectionAttempts}/5 failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!connected) {
            throw new Error('MySQL started but connection test failed after multiple attempts');
        }

        console.log('\n═══════════════════════════════════════════════════');
        console.log('✅ MySQL installed and started successfully!');
        console.log('═══════════════════════════════════════════════════\n');

        // Save installation info
        const installInfoPath = path.join(mysqlDir, 'install-info.json');
        fs.writeFileSync(installInfoPath, JSON.stringify({
            installed: true,
            timestamp: new Date().toISOString(),
            mysqlPath: actualMySQLPath,
            dataPath: mysqlDataDir,
            port: 3306,
            version: extractedFolders[0]
        }, null, 2));

        return {
            success: true,
            mysqlPath: actualMySQLPath,
            dataPath: mysqlDataDir,
            process: mysqlProcess,
            port: 3306
        };

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════');
        console.error('❌ MySQL installation failed');
        console.error('═══════════════════════════════════════════════════');
        console.error('Error:', error.message);
        console.error('\nPlease try installing MySQL manually:');
        console.error('- Download from: https://dev.mysql.com/downloads/installer/');
        console.error('- Or run: winget install Oracle.MySQL');
        console.error('═══════════════════════════════════════════════════\n');

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Ensure MySQL is available (check, start, or install)
 */
async function ensureMySQLAvailable(appDataPath) {
    console.log('🔍 Checking MySQL availability...');

    const localConfig = getLocalMySqlConfig();

    // Step 1: Check if MySQL is installed
    const installedCheck = await checkMySQLInstalled();

    if (installedCheck.installed) {
        console.log('✅ MySQL is installed on the system');

        // Step 2: Test connection
        const connectionTest = await testMySQLConnection(
            localConfig.host,
            localConfig.port,
            localConfig.user,
            localConfig.password
        );

        if (connectionTest.connected) {
            console.log('✅ MySQL is running and accessible');
            return { available: true, type: 'installed', running: true };
        }

        if (connectionTest.error && connectionTest.error.toLowerCase().includes('access denied')) {
            console.log('⚠️  MySQL is running, but the configured credentials were rejected');
            return {
                available: false,
                type: 'installed',
                running: true,
                message: `MySQL is running, but the configured credentials could not connect: ${connectionTest.error}`
            };
        }

        // Step 3: Try to start the service
        console.log('⚠️  MySQL installed but not running, attempting to start...');
        const startResult = await startMySQLService();

        if (startResult.started) {
            // Test connection again
            const retestConnection = await testMySQLConnection(
                localConfig.host,
                localConfig.port,
                localConfig.user,
                localConfig.password
            );
            if (retestConnection.connected) {
                console.log('✅ MySQL service started successfully');
                return { available: true, type: 'installed', running: true, started: true };
            }

            if (retestConnection.error && retestConnection.error.toLowerCase().includes('access denied')) {
                return {
                    available: false,
                    type: 'installed',
                    running: true,
                    message: `MySQL is running, but the configured credentials could not connect: ${retestConnection.error}`
                };
            }
        }

        console.log('⚠️  MySQL installed but could not be started automatically');
        return {
            available: false,
            type: 'installed',
            running: false,
            message: 'MySQL is installed but not running. Please start MySQL service manually.'
        };
    }

    // Step 4: MySQL not installed, attempt installation
    console.log('⚠️  MySQL not found - Installation required');
    const installResult = await installAndSetupMySQL(appDataPath);

    if (installResult.needsManualInstall) {
        return {
            available: false,
            type: 'not-installed',
            needsManualInstall: true,
            message: installResult.message
        };
    }

    if (installResult.success) {
        return {
            available: true,
            type: 'portable',
            running: true,
            mysqlPath: installResult.mysqlPath
        };
    }

    return {
        available: false,
        type: 'not-installed',
        error: installResult.error
    };
}

module.exports = {
    checkMySQLInstalled,
    testMySQLConnection,
    startMySQLService,
    installAndSetupMySQL,
    ensureMySQLAvailable
};
