const cron = require('node-cron');
const { execSync } = require('child_process');
const licenceManagementController = require('../controllers/licenceManagementController');
const prisma = require('../config/prismaClient');

function getWindowsUUID() {
    try {
        const stdout = execSync('wmic csproduct get uuid').toString();
        return stdout.split('\n')[1].trim();
    } catch (error) {
        return null;
    }
}

// Base schedule runs every hour (on the hour)
const scheduleSubscriptionVerification = () => {
    const cronExpression = '0 * * * *';

    if (!cron.validate(cronExpression)) {
        console.error('Invalid subscription verification cron expression');
        return null;
    }

    const task = cron.schedule(cronExpression, async () => {
        try {
            // Check current subscription db_type
            const subscription = await prisma.subscription.findFirst();
            const isOnline = subscription?.db_type === 'online';

            if (!isOnline) {
                // If offline (or not configured yet), only allow processing at 9:00 AM and 5:00 PM
                const colomboTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" });
                const currentHour = new Date(colomboTime).getHours();
                
                if (currentHour !== 9 && currentHour !== 17) {
                    return; // Skip silently if not one of the designated twice-daily times
                }
            }

            console.log(`[${new Date().toISOString()}] Running scheduled subscription verification...`);
            const device_id = getWindowsUUID();
            if (!device_id) {
                console.log('Subscription verification skipped: unable to resolve device ID');
                return;
            }

            // Trigger the same flow as the HTTP controller with an explicit device ID.
            const mockReq = { body: { device_id } };
            const mockRes = {
                statusCode: 200,
                skipped: false,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    if (payload?.message === 'Unauthenticated.' || payload?.message?.includes('Access token not found')) {
                        this.skipped = true;
                        console.log(`ℹ️  Subscription verification skipped: ${payload.message}`);
                        return payload;
                    }
                    if (this.statusCode >= 400) {
                        throw new Error(payload?.message || 'Profile refresh failed');
                    }
                    return payload;
                }
            };

            await licenceManagementController.getProfile(mockReq, mockRes);
            
            if (!mockRes.skipped) {
                console.log(`Scheduled subscription verification completed (profile refreshed for device_id=${device_id})`);
            }
        } catch (error) {
            console.error('Scheduled subscription verification failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Colombo'
    });

    console.log('Subscription verification scheduler initialized - Runs hourly for online DB, twice daily (9 AM & 5 PM) for offline DB.');

    return task;
};

module.exports = {
    scheduleSubscriptionVerification
};
