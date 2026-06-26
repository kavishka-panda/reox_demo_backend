const prisma = require('../config/prismaClient');

const dbOnlineCheckModel = {
    async isOnlineDbType() {
        const subscription = await prisma.subscription.findFirst({
            orderBy: { id: 'desc' }
        });

        if (!subscription || !subscription.db_type) {
            return false;
        }

        return String(subscription.db_type).toLowerCase() === 'online';
    }
};

module.exports = dbOnlineCheckModel;
