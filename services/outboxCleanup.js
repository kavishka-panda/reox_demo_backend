const prisma = require('../config/prismaClient');
const log = require('electron-log');
require('dotenv').config();

const dataLogger = log.scope('outboxCleanup');

function getEnvInt(name, fallback) {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

const RETENTION_DAYS = getEnvInt('SYNC_OUTBOX_RETENTION_DAYS', 14);
const CLEANUP_INTERVAL_MS = getEnvInt('SYNC_OUTBOX_CLEANUP_INTERVAL_MS', 24 * 60 * 60 * 1000); // 24h

let cleanupTimer = null;
let isRunning = false;
let lastCleanupRun = null;
let lastCleanupCount = 0;
let lastCleanupError = null;

async function runCleanupOnce() {
    try {
        // Hard delete rows that are synced and older than the retention period.
        const deleted = await prisma.$executeRawUnsafe(
            `DELETE FROM \`sync_outbox\` WHERE \`status\` = 'synced' AND \`created_at\` < DATE_SUB(NOW(3), INTERVAL ${RETENTION_DAYS} DAY)`
        );

        lastCleanupRun = new Date().toISOString();
        lastCleanupCount = deleted;
        lastCleanupError = null;
        dataLogger.info(`Outbox hard delete removed ${deleted} synced rows older than ${RETENTION_DAYS} days`);
        return deleted;
    } catch (error) {
        lastCleanupRun = new Date().toISOString();
        lastCleanupError = error?.message || String(error);
        dataLogger.error('Outbox hard delete failed: ' + (error?.message || error));
        return 0;
    }
}

function startCleanupWorker(intervalMs = CLEANUP_INTERVAL_MS) {
    if (isRunning) return;
    isRunning = true;
    // Run immediately once
    runCleanupOnce().catch(() => {});

    cleanupTimer = setInterval(() => {
        runCleanupOnce().catch(() => {});
    }, intervalMs);

    dataLogger.info(`Outbox hard delete worker started (retention=${RETENTION_DAYS}d, interval=${intervalMs}ms)`);
}

async function stopCleanupWorker() {
    if (!isRunning) return;
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    isRunning = false;
    dataLogger.info('Outbox hard delete worker stopped');
}

module.exports = {
    startCleanupWorker,
    stopCleanupWorker,
    runCleanupOnce,
    getCleanupStatus() {
        return {
            retentionDays: RETENTION_DAYS,
            intervalMs: CLEANUP_INTERVAL_MS,
            isRunning,
            lastCleanupRun,
            lastCleanupCount,
            lastCleanupError
        };
    }
};
