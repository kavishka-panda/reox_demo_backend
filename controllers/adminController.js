const prisma = require('../config/prismaClient');
const syncWorker = require('../services/backgroundSyncWorker');
const outboxCleanup = require('../services/outboxCleanup');

function getRetentionDays() {
    const value = parseInt(process.env.SYNC_OUTBOX_RETENTION_DAYS, 10);
    return Number.isFinite(value) && value > 0 ? value : 14;
}

const adminController = {
    async getSyncStatus(req, res) {
        try {
            const retentionDays = getRetentionDays();

            const [pendingCount, syncedTotal, cleanupReadyCount, syncStats, cleanupStatus] = await Promise.all([
                prisma.sync_outbox.count({ where: { status: 'pending' } }),
                prisma.sync_outbox.count({ where: { status: 'synced' } }),
                prisma.$queryRawUnsafe(
                    `SELECT COUNT(*) AS count FROM \`sync_outbox\` WHERE \`status\` = 'synced' AND \`created_at\` < DATE_SUB(NOW(3), INTERVAL ${retentionDays} DAY)`
                ),
                Promise.resolve(syncWorker.getStats()),
                Promise.resolve(outboxCleanup.getCleanupStatus())
            ]);

            const cleanupCount = Array.isArray(cleanupReadyCount) && cleanupReadyCount[0]
                ? Number(cleanupReadyCount[0].count || 0)
                : 0;

            return res.json({
                pending_sync_count: pendingCount,
                synced_total: syncStats?.totalSynced ?? syncedTotal,
                cleanup_ready_count: cleanupCount,
                last_cleanup_run: cleanupStatus?.lastCleanupRun || null
            });
        } catch (error) {
            console.error('Error loading sync status:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to load sync status'
            });
        }
    }
};

module.exports = adminController;