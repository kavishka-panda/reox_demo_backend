const subscriptionLocalModel = require('../models/subscriptionLocalModel');

const subscriptionLocalController = {
    async getSubscriptionLocal(req, res) {
        try {
            const subscription = await subscriptionLocalModel.getSubscriptionLocal();

            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    message: 'No local subscription found.'
                });
            }

            res.json({
                success: true,
                data: subscription
            });
        } catch (error) {
            console.error('Error fetching local subscription:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = subscriptionLocalController;