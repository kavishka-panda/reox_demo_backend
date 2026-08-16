/**
 * Sync Middleware
 * 
 * Manages background sync worker lifecycle.
 */

const syncWorker = require('../services/backgroundSyncWorker');
const outboxCleanup = require('../services/outboxCleanup');

/**
 * Initialize sync services
 * Call this during server startup
 * @param {string} mode - 'online' or 'offline'
 */
async function initializeSyncServices(mode = 'offline') {
    try {
        console.log('🔄 Initializing sync services...');

        syncWorker.setMode(mode);
        console.log('🚀 Starting background sync worker...');
        await syncWorker.start();
        // Start outbox cleanup worker (removes synced rows older than retention period)
        try {
            outboxCleanup.startCleanupWorker();
        } catch (err) {
            console.warn('⚠️  Failed to start outbox cleanup worker:', err.message || err);
        }
        
        console.log('✅ Sync services initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize sync services:', error.message);
        return false;
    }
}

/**
 * Set sync mode (online/offline)
 * Call this when database mode changes
 * @param {string} mode - 'online' or 'offline'
 */
async function setSyncMode(mode) {
    syncWorker.setMode(mode);

    // Keep worker running and switch behavior by mode.
    if (!syncWorker.isRunning) {
        console.log('🚀 Starting background sync worker...');
        await syncWorker.start();
    }

    if (mode === 'online') {
        await syncWorker.refreshOnlineConnection();
        await syncWorker.forceSyncNow();
    }
    
    console.log(`🔄 Sync mode set to: ${mode.toUpperCase()}`);
}

/**
 * Cleanup sync services
 * Call this during server shutdown
 */
async function cleanupSyncServices() {
    try {
        console.log('🛑 Cleaning up sync services...');
        
        // Add timeout to force cleanup after 5 seconds
        const cleanupPromise = Promise.all([syncWorker.stop(), outboxCleanup.stopCleanupWorker()]);
        
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.warn('⚠️  Cleanup timeout reached, forcing shutdown...');
                resolve(false);
            }, 5000); // 5 second timeout
        });
        
        await Promise.race([cleanupPromise, timeoutPromise]);
        
        console.log('✅ Sync services cleaned up successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to cleanup sync services:', error.message);
        return false;
    }
}

/**
 * Get sync statistics
 */
function getSyncStats() {
    return syncWorker.getStats();
}

/**
 * Force sync now (manual trigger)
 */
async function forceSyncNow() {
    return await syncWorker.forceSyncNow();
}

module.exports = {
    // Initialization
    initializeSyncServices,
    setSyncMode,
    cleanupSyncServices,
    
    // Statistics
    getSyncStats,
    forceSyncNow
};
