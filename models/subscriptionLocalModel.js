const prisma = require('../config/prismaClient');

const subscriptionLocalModel = {
    async getSubscriptionLocal() {
        return prisma.subscription.findFirst({
            select: {
                license_key: true,
                id: true,
                status: true,
                expiry_date: true,
                db_type: true,
                last_sync_at: true,
            }
        });
    }
};

module.exports = subscriptionLocalModel;