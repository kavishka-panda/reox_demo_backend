const cron = require('node-cron');
const { BackupService } = require('../services/backupService');

const backupService = new BackupService();

// Run backup daily at 5:00 PM
const scheduleBackup = () => {
    // Cron expression for 5:00 PM (17:00)
    const cronExpression = '0 17 * * *';

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
        console.error('Invalid cron expression');
        return;
    }

    // Schedule daily backup at 5:00 PM
    const task = cron.schedule(cronExpression, async () => {
        console.log(`[${new Date().toISOString()}] Running scheduled backup...`);
        try {
            const result = await backupService.createBackup();
            console.log(`✅ Backup created: ${result.filename} (${result.size})`);

            // Clean old backups (keep last 7)
            const cleaned = await backupService.cleanOldBackups(7);
            console.log(`🗑️  Cleaned ${cleaned.deleted} old backup(s)`);

            console.log('✅ Scheduled backup completed successfully');
        } catch (error) {
            console.error('❌ Scheduled backup failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Colombo" // Change to your timezone
    });

    console.log('📅 Backup scheduler initialized - Daily at 5:00 PM');

    return task;
};

// Optional: Manual trigger for testing
const triggerManualBackup = async () => {
    console.log('🔧 Manual backup triggered...');
    try {
        const result = await backupService.createBackup();
        console.log(`✅ Manual backup created: ${result.filename} (${result.size})`);
        return result;
    } catch (error) {
        console.error('❌ Manual backup failed:', error.message);
        throw error;
    }
};

// Get next scheduled run time (5:00 PM)
const getNextScheduledTime = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(17, 0, 0, 0); // Set to 5:00 PM

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    return next;
};

module.exports = {
    scheduleBackup,
    triggerManualBackup,
    getNextScheduledTime
};
