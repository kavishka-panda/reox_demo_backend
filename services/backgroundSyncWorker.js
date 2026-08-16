/**
 * Background Sync Worker
 * 
 * Implements CDC Outbox pattern:
 * - Consumes pending rows from sync_outbox
 * - Applies them to online DB in eventual-consistency mode
 * 
 * Features:
 * - Runs on a configurable interval
 * Outbox-based batch processing
 * - Retry logic with exponential backoff
 * - Graceful error handling
 */

const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');
const path = require('path');
const os = require('os');
const fs = require('fs');
const log = require('electron-log');
const dbConfigModel = require('../models/dbConfigModel');
const dbOnlineCheckModel = require('../models/dbOnlineCheckModel');
require('dotenv').config();

const roamingDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dataSyncLogPath = path.join(roamingDir, 'Reox', 'logs', 'datasync.log');
fs.mkdirSync(path.dirname(dataSyncLogPath), { recursive: true });
log.transports.file.resolvePathFn = () => dataSyncLogPath;

// Configure electron-log for datasync
const dataSyncLogger = log.scope('datasync');

// Configuration
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || 60000; // 60 seconds default
const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE) || 50; // Process 50 outbox events at a time
const MAX_BATCHES_PER_CYCLE = parseInt(process.env.SYNC_MAX_BATCHES_PER_TABLE) || 200;
const MAX_OUTBOX_RETRIES = parseInt(process.env.SYNC_OUTBOX_MAX_RETRIES) || 10;

const OUTBOX_TABLE = 'sync_outbox';

// Primary key mapping for tables with non-standard primary key names
const PRIMARY_KEY_MAP = {
    'brand': 'idbrand',
    'category': 'idcategory',
    'product_status': 'idproduct_status',
    'product_type': 'idproduct_type',
    'unit_id': 'idunit_id'
};

/**
 * Write to datasync log file
 * @param {string} message - Log message
 * @param {string} level - Log level (INFO, ERROR, SUCCESS, WARN)
 */
function writeDataSyncLog(message, level = 'INFO') {
    switch (level.toUpperCase()) {
        case 'ERROR':
            dataSyncLogger.error(message);
            break;
        case 'WARN':
            dataSyncLogger.warn(message);
            break;
        case 'SUCCESS':
            dataSyncLogger.info(`✅ ${message}`);
            break;
        case 'INFO':
        default:
            dataSyncLogger.info(message);
            break;
    }
}

/**
 * Get the primary key field name for a table
 * @param {string} tableName - Name of the table
 * @returns {string} Primary key field name
 */
function getPrimaryKey(tableName) {
    return PRIMARY_KEY_MAP[tableName] || 'id';
}

/**
 * Detect foreign-key dependency errors (e.g., child row before parent row)
 */
function isForeignKeyDependencyError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('foreign key constraint fails') || message.includes('code: `1452`');
}

/**
 * Sanitize datetime fields in a record
 * Converts invalid datetime values (with day or month set to zero) to null
 * @param {Object} recordData - The record data to sanitize
 * @returns {Object} Sanitized record data
 */
function sanitizeDatetimeFields(recordData) {
    const sanitized = { ...recordData };
    
    // Regex to detect invalid dates (zero month or day)
    const invalidDatePattern = /^\d{4}-(00|0[0-9]|1[0-2])-(00)/;
    const zeroMonthPattern = /^\d{4}-00-/;
    
    for (const [key, value] of Object.entries(sanitized)) {
        // Check if this looks like a date field
        if (value !== null && value !== undefined) {
            // Handle string date values
            if (typeof value === 'string') {
                // Check for invalid date patterns
                if (invalidDatePattern.test(value) || zeroMonthPattern.test(value) || value.includes('-00-') || value.includes('-00 ')) {
                    console.log(`   🔧 [SyncWorker] Sanitizing invalid date in field '${key}': ${value} -> null`);
                    sanitized[key] = null;
                }
                // Check for '0000-00-00' or '0000-00-00 00:00:00'
                else if (value.startsWith('0000-00-00')) {
                    console.log(`   🔧 [SyncWorker] Sanitizing zero date in field '${key}': ${value} -> null`);
                    sanitized[key] = null;
                }
            }
            // Handle Date objects
            else if (value instanceof Date) {
                // Check if Date is invalid
                if (isNaN(value.getTime())) {
                    console.log(`   🔧 [SyncWorker] Sanitizing invalid Date object in field '${key}' -> null`);
                    sanitized[key] = null;
                }
            }
        }
    }
    
    return sanitized;
}

class BackgroundSyncWorker {
    constructor() {
        this.localPrisma = null;
        this.onlinePrisma = null;
        this.isRunning = false;
        this.isSyncInProgress = false;
        this.syncTimer = null;
        this.currentMode = 'offline';
        this.isFallbackInProgress = false;
        this.stats = {
            totalSynced: 0,
            totalFailed: 0,
            lastSyncTime: null,
            lastError: null
        };
        this.fkMetadataCache = new Map();
    }

    async getForeignKeysForTable(tableName) {
        if (this.fkMetadataCache.has(tableName)) {
            return this.fkMetadataCache.get(tableName);
        }

        const foreignKeys = await this.localPrisma.$queryRawUnsafe(
            `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND REFERENCED_TABLE_NAME IS NOT NULL`,
            tableName
        );

        this.fkMetadataCache.set(tableName, foreignKeys);
        return foreignKeys;
    }

    async enqueueOutboxEventIfMissing(tableName, recordId, payload) {
        const existingPending = await this.localPrisma.$queryRawUnsafe(
            `SELECT id
             FROM \`${OUTBOX_TABLE}\`
             WHERE \`table_name\` = ?
               AND \`record_id\` = ?
               AND \`action\` = 'INSERT'
               AND \`status\` = 'pending'
             LIMIT 1`,
            tableName,
            String(recordId)
        );

        if (existingPending.length > 0) {
            return false;
        }

        const payloadJson = JSON.stringify(payload ?? {});
        await this.localPrisma.$executeRawUnsafe(
            `INSERT INTO \`${OUTBOX_TABLE}\` (\`table_name\`, \`record_id\`, \`action\`, \`payload\`, \`status\`, \`retry_count\`, \`last_error\`, \`created_at\`, \`updated_at\`)
             VALUES (?, ?, 'INSERT', CAST(? AS JSON), 'pending', 0, NULL, NOW(3), NOW(3))`,
            tableName,
            String(recordId),
            payloadJson
        );

        return true;
    }

    async connectOnlinePrisma() {
        try {
            await dbConfigModel.fetchOnlineDatabaseData();
        } catch (refreshError) {
            console.warn('⚠️  [SyncWorker] Failed to refresh online db config before connect:', refreshError.message);
            writeDataSyncLog(`Failed to refresh online db config before connect: ${refreshError.message}`, 'WARN');
        }

        const activeConfig = await dbConfigModel.getActiveConfig();
        if (!activeConfig?.host || !activeConfig?.user || !activeConfig?.password || !activeConfig?.database) {
            throw new Error('No active online database config found');
        }

        const encodedOnlinePassword = encodeURIComponent(activeConfig.password);
        const onlineDatabaseUrl = `mysql://${activeConfig.user}:${encodedOnlinePassword}@${activeConfig.host}:${activeConfig.port}/${activeConfig.database}?connection_limit=20&pool_timeout=30`;

        if (this.onlinePrisma) {
            try {
                await this.onlinePrisma.$disconnect();
            } catch (disconnectError) {
                console.warn('⚠️  [SyncWorker] Failed to disconnect existing online Prisma before reconnect:', disconnectError.message);
            }
        }

        this.onlinePrisma = new PrismaClient({
            datasources: { db: { url: onlineDatabaseUrl } }
        });

        this.currentMode = 'online';
        console.log('🔄 [SyncWorker] Online Prisma client initialized');
        writeDataSyncLog('Online Prisma client initialized (subscription db_type = online)', 'SUCCESS');
        return true;
    }

    async refreshOnlineConnection() {
        const isOnline = await dbOnlineCheckModel.isOnlineDbType();
        if (!isOnline) {
            this.currentMode = 'offline';
            console.log('💾 [SyncWorker] Subscription db_type is not online; skipping online Prisma initialization');
            writeDataSyncLog('Subscription db_type is not online; online Prisma not initialized', 'WARN');
            return false;
        }

        await this.connectOnlinePrisma();
        return true;
    }

    async recoverMissingParentDependencies(event) {
        if (!event || event.action === 'DELETE') {
            return 0;
        }

        const payload = typeof event.payload === 'string'
            ? JSON.parse(event.payload)
            : (event.payload || {});

        const foreignKeys = await this.getForeignKeysForTable(event.table_name);
        let enqueuedCount = 0;

        for (const fk of foreignKeys) {
            const fkColumn = fk.COLUMN_NAME;
            const parentTable = fk.REFERENCED_TABLE_NAME;
            const parentPk = fk.REFERENCED_COLUMN_NAME;
            const parentRecordId = payload[fkColumn];

            if (parentRecordId === null || parentRecordId === undefined) {
                continue;
            }

            const parentOnline = await this.onlinePrisma.$queryRawUnsafe(
                `SELECT 1 AS present FROM \`${parentTable}\` WHERE \`${parentPk}\` = ? LIMIT 1`,
                parentRecordId
            );

            if (parentOnline.length > 0) {
                continue;
            }

            const localParentRows = await this.localPrisma.$queryRawUnsafe(
                `SELECT * FROM \`${parentTable}\` WHERE \`${parentPk}\` = ? LIMIT 1`,
                parentRecordId
            );

            if (localParentRows.length === 0) {
                continue;
            }

            const enqueued = await this.enqueueOutboxEventIfMissing(parentTable, parentRecordId, localParentRows[0]);
            if (enqueued) {
                enqueuedCount++;
                writeDataSyncLog(
                    `Auto-enqueued missing parent dependency ${parentTable}#${parentRecordId} for ${event.table_name}#${event.record_id}`,
                    'WARN'
                );
            }
        }

        return enqueuedCount;
    }


    /**
     * Detect connectivity errors that indicate online DB is unreachable
     */
    isOnlineConnectivityError(error) {
        const message = String(error?.message || '').toLowerCase();
        return (
            message.includes("can't reach database server") ||
            message.includes('connect etimedout') ||
            message.includes('connect econnrefused') ||
            message.includes('enotfound') ||
            message.includes('ehostunreach') ||
            message.includes('socket timeout')
        );
    }

    /**
     * Auto-fallback to offline mode when online DB connection is lost
     */
    async fallbackToOffline(reason) {
        if (this.isFallbackInProgress || this.currentMode !== 'online') {
            return;
        }

        this.isFallbackInProgress = true;

        try {
            console.error(`❌ [SyncWorker] Online DB unreachable. Auto-switching to OFFLINE mode. Reason: ${reason}`);
            writeDataSyncLog(`Auto-switching to OFFLINE mode due to connectivity failure: ${reason}`, 'ERROR');

            // Persist mode change so frontend can immediately reflect OFFLINE state.
            await dbConfigModel.switchMode('offline');

            // Update in-memory state.
            this.currentMode = 'offline';

            try {
                const db = require('../config/db');
                if (db?.dbManager?.setMode) {
                    db.dbManager.setMode('offline');
                }
            } catch (modeError) {
                console.warn('⚠️  [SyncWorker] Failed to update DB manager mode:', modeError.message);
            }

            if (this.onlinePrisma) {
                try {
                    await this.onlinePrisma.$disconnect();
                } catch (disconnectError) {
                    console.warn('⚠️  [SyncWorker] Failed to disconnect online Prisma:', disconnectError.message);
                }
                this.onlinePrisma = null;
            }

            console.log('✅ [SyncWorker] Auto-sync disabled. System is now in OFFLINE mode.');
            writeDataSyncLog('Auto-sync disabled; mode switched to OFFLINE', 'WARN');
        } catch (fallbackError) {
            console.error('❌ [SyncWorker] Failed to auto-fallback to offline mode:', fallbackError.message);
            writeDataSyncLog(`Failed to auto-fallback to offline mode: ${fallbackError.message}`, 'ERROR');
        } finally {
            this.isFallbackInProgress = false;
        }
    }

    /**
     * Initialize Prisma clients
     */
    async initialize() {
        try {
            const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
            const dbPort = DB_PORT || '3306';
            const encodedPassword = encodeURIComponent(DB_PASSWORD || '');
            const localDatabaseUrl = `mysql://${DB_USER}:${encodedPassword}@${DB_HOST}:${dbPort}/${DB_NAME}?connection_limit=20&pool_timeout=30`;

            this.localPrisma = new PrismaClient({
                datasources: { db: { url: localDatabaseUrl } }
            });

            console.log('🔄 [SyncWorker] Local Prisma client initialized');
            writeDataSyncLog('Local Prisma client initialized', 'SUCCESS');

            const localConfig = {
                host: DB_HOST || 'localhost',
                user: DB_USER || 'root',
                password: DB_PASSWORD || '',
                database: DB_NAME || 'reox_pos',
                port: parseInt(dbPort)
            };

            const tempConnection = await mysql.createConnection(localConfig);
            await tempConnection.end();

            await this.refreshOnlineConnection();
        } catch (error) {
            console.error('❌ [SyncWorker] Initialization failed:', error.message);
            writeDataSyncLog(`Initialization failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Start the background sync worker
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️  [SyncWorker] Already running');
            return;
        }

        console.log('🚀 [SyncWorker] Starting background sync worker...');
        console.log(`📊 [SyncWorker] Sync interval: ${SYNC_INTERVAL / 1000} seconds`);
        console.log(`📦 [SyncWorker] Batch size: ${BATCH_SIZE} records`);

        writeDataSyncLog('Background sync worker starting...', 'INFO');
        writeDataSyncLog(`Sync interval: ${SYNC_INTERVAL / 1000} seconds, Batch size: ${BATCH_SIZE} records`, 'INFO');

        await this.initialize();
        this.isRunning = true;

        // Run initial sync
        this.runSyncCycle();

        // Schedule periodic syncs
        this.syncTimer = setInterval(() => {
            this.runSyncCycle();
        }, SYNC_INTERVAL);

        console.log('✅ [SyncWorker] Background sync worker started');
        writeDataSyncLog('Background sync worker started successfully', 'SUCCESS');
    }

    /**
     * Stop the background sync worker
     */
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️  [SyncWorker] Already stopped');
            return;
        }

        console.log('🛑 [SyncWorker] Stopping background sync worker...');
        writeDataSyncLog('Background sync worker stopping...', 'INFO');
        
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        this.isRunning = false;

        // Disconnect with timeout protection
        try {
            if (this.localPrisma) {
                await Promise.race([
                    this.localPrisma.$disconnect(),
                    new Promise(resolve => setTimeout(resolve, 2000))
                ]);
                this.localPrisma = null;
            }
            if (this.onlinePrisma) {
                await Promise.race([
                    this.onlinePrisma.$disconnect(),
                    new Promise(resolve => setTimeout(resolve, 2000))
                ]);
                this.onlinePrisma = null;
            }
        } catch (error) {
            console.warn('⚠️  [SyncWorker] Error during disconnect:', error.message);
            writeDataSyncLog(`Error during disconnect: ${error.message}`, 'WARN');
        }

        console.log('✅ [SyncWorker] Background sync worker stopped');
        writeDataSyncLog('Background sync worker stopped', 'SUCCESS');
    }

    /**
     * Run a complete sync cycle
     */
    async runSyncCycle() {
        if (this.isSyncInProgress) {
            console.log('⏭️  [SyncWorker] Previous sync cycle is still running; skipping overlap cycle');
            return;
        }

        // Only sync when in online mode and online DB is available
        if (this.currentMode !== 'online' || !this.onlinePrisma) {
            console.log('⏭️  [SyncWorker] Skipping sync (offline mode or no online DB)');
            return;
        }

        this.isSyncInProgress = true;

        console.log('\n🔄 [SyncWorker] Starting sync cycle...');
        writeDataSyncLog('Starting sync cycle...', 'INFO');
        const cycleStart = Date.now();
        let totalSynced = 0;
        let totalFailed = 0;

        try {
            const result = await this.syncOutboxBatch();
            totalSynced += result.synced;
            totalFailed += result.failed;

            const cycleEnd = Date.now();
            const duration = ((cycleEnd - cycleStart) / 1000).toFixed(2);

            this.stats.totalSynced += totalSynced;
            this.stats.totalFailed += totalFailed;
            this.stats.lastSyncTime = new Date().toISOString();

            console.log('📊 [SyncWorker] Sync cycle completed:');
            console.log(`   ✅ Synced: ${totalSynced} records`);
            console.log(`   ❌ Failed: ${totalFailed} records`);
            console.log(`   ⏱️  Duration: ${duration}s`);
            console.log(`   📈 Total Stats: ${this.stats.totalSynced} synced, ${this.stats.totalFailed} failed\n`);

            // Log sync cycle summary
            const logLevel = totalFailed > 0 ? 'WARN' : 'SUCCESS';
            const logMessage = `Sync cycle completed: ${totalSynced} synced, ${totalFailed} failed, Duration: ${duration}s, Total: ${this.stats.totalSynced} synced, ${this.stats.totalFailed} failed`;
            writeDataSyncLog(logMessage, logLevel);
        } finally {
            this.isSyncInProgress = false;
        }
    }

    /**
     * Sync pending outbox events to online DB
     */
    async syncOutboxBatch() {
        try {
            let synced = 0;
            let failed = 0;
            let deferred = 0;
            let batchCount = 0;

            while (batchCount < MAX_BATCHES_PER_CYCLE) {
                const pendingEvents = await this.localPrisma.$queryRawUnsafe(
                    `SELECT * FROM \`${OUTBOX_TABLE}\` WHERE \`status\` = 'pending' ORDER BY \`retry_count\` ASC, \`id\` ASC LIMIT ${BATCH_SIZE}`
                );

                if (pendingEvents.length === 0) {
                    break;
                }

                batchCount++;
                console.log(`🔄 [SyncWorker] Processing ${pendingEvents.length} outbox events (batch ${batchCount})...`);

                let syncedThisBatch = 0;

                for (const event of pendingEvents) {
                    try {
                        await this.applyOutboxEventToOnline(event);

                        await this.localPrisma.$executeRawUnsafe(
                            `UPDATE \`${OUTBOX_TABLE}\` SET \`status\` = 'synced', \`last_error\` = NULL WHERE \`id\` = ?`,
                            event.id
                        );

                        synced++;
                        syncedThisBatch++;
                    } catch (error) {
                        const outboxTag = `${event.table_name}#${event.record_id} (${event.action})`; 

                        if (this.isOnlineConnectivityError(error)) {
                            console.error(`⚠️  [SyncWorker] Connectivity issue while syncing outbox event ${outboxTag}:`, error.message);
                            writeDataSyncLog(`Connectivity issue while syncing outbox event ${outboxTag}: ${error.message}`, 'ERROR');
                            await this.fallbackToOffline(error.message);
                            return { synced, failed: failed + 1 };
                        }

                        if (isForeignKeyDependencyError(error)) {
                            const nextRetryCount = (event.retry_count || 0) + 1;
                            const nextStatus = nextRetryCount >= MAX_OUTBOX_RETRIES ? 'failed' : 'pending';
                            const recoveredParents = await this.recoverMissingParentDependencies(event);
                            deferred++;
                            console.warn(`⏸️  [SyncWorker] Deferred outbox event ${outboxTag} (missing parent row online): ${error.message}`);
                            writeDataSyncLog(`Deferred outbox event ${outboxTag} due to FK dependency: ${error.message}`, 'WARN');
                            if (recoveredParents > 0) {
                                writeDataSyncLog(`Recovered ${recoveredParents} missing parent dependency event(s) for ${outboxTag}`, 'WARN');
                            }

                            await this.localPrisma.$executeRawUnsafe(
                                `UPDATE \`${OUTBOX_TABLE}\` SET \`retry_count\` = ?, \`last_error\` = ?, \`status\` = ? WHERE \`id\` = ?`,
                                nextRetryCount,
                                error.message,
                                nextStatus,
                                event.id
                            );

                            if (nextStatus === 'failed') {
                                failed++;
                                writeDataSyncLog(`Outbox event ${outboxTag} marked as failed after ${nextRetryCount} retries`, 'ERROR');
                            }

                            continue;
                        }

                        console.error(`⚠️  [SyncWorker] Failed to sync outbox event ${outboxTag}:`, error.message);
                        writeDataSyncLog(`Failed to sync outbox event ${outboxTag}: ${error.message}`, 'ERROR');

                        await this.localPrisma.$executeRawUnsafe(
                            `UPDATE \`${OUTBOX_TABLE}\` SET \`retry_count\` = ?, \`last_error\` = ?, \`status\` = 'failed' WHERE \`id\` = ?`,
                            (event.retry_count || 0) + 1,
                            error.message,
                            event.id
                        );

                        failed++;
                    }
                }

                // Prevent infinite loops when all rows in batch are deferred/failed.
                if (syncedThisBatch === 0) {
                    break;
                }
            }

            if (failed > 0 || deferred > 0) {
                writeDataSyncLog(`Outbox batch result: ${synced} synced, ${failed} failed, ${deferred} deferred`, 'WARN');
            }

            return { synced, failed };
        } catch (error) {
            console.error('❌ [SyncWorker] Error processing outbox:', error.message);
            writeDataSyncLog(`Error processing outbox: ${error.message}`, 'ERROR');

            if (this.isOnlineConnectivityError(error)) {
                await this.fallbackToOffline(error.message);
            }

            return { synced: 0, failed: 0 };
        }
    }

    async processOutboxItem(event) {
        const tableName = event.table_name;
        const primaryKey = getPrimaryKey(tableName);

        switch (event.action) {
            case 'DELETE': {
                // Idempotent delete: row-not-found is treated as success.
                await this.onlinePrisma.$executeRawUnsafe(
                    `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
                    event.record_id
                );
                return;
            }
            case 'INSERT':
            case 'UPDATE': {
                // Use UPSERT for idempotency when an event is retried.
                const rawPayload = typeof event.payload === 'string'
                    ? JSON.parse(event.payload)
                    : (event.payload || {});

                const sanitizedData = sanitizeDatetimeFields(rawPayload);
                const insertKeys = Object.keys(sanitizedData);

                if (insertKeys.length === 0) {
                    throw new Error(`Outbox payload has no fields for ${tableName}#${event.record_id}`);
                }

                const insertFields = insertKeys.map(key => `\`${key}\``).join(', ');
                const placeholders = insertKeys.map(() => '?').join(', ');
                const insertValues = insertKeys.map(key => sanitizedData[key]);
                const updateKeys = insertKeys.filter(key => key !== primaryKey);
                const duplicateUpdateClause = updateKeys.length > 0
                    ? updateKeys.map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ')
                    : `\`${primaryKey}\` = VALUES(\`${primaryKey}\`)`;

                await this.onlinePrisma.$executeRawUnsafe(
                    `INSERT INTO \`${tableName}\` (${insertFields}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${duplicateUpdateClause}`,
                    ...insertValues
                );
                return;
            }
            default:
                throw new Error(`Unsupported outbox action: ${event.action}`);
        }
    }

    async applyOutboxEventToOnline(event) {
        return this.processOutboxItem(event);
    }

    /**
     * Get sync statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            currentMode: this.currentMode
        };
    }

    /**
     * Force sync now (manual trigger)
     */
    async forceSyncNow() {
        console.log('⚡ [SyncWorker] Manual sync triggered');
        await this.runSyncCycle();
    }

    /**
     * Set mode (online/offline)
     */
    setMode(mode) {
        console.log(`🔄 [SyncWorker] Mode changed to: ${mode.toUpperCase()}`);
        this.currentMode = mode;
    }
}

// Export singleton instance
const syncWorker = new BackgroundSyncWorker();

module.exports = syncWorker;
