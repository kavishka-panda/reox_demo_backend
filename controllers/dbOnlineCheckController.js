const dbOnlineCheckModel = require('../models/dbOnlineCheckModel');

const dbOnlineCheckController = {
    async checkIsOnline(req, res) {
        try {
            const isOnline = await dbOnlineCheckModel.isOnlineDbType();
            return res.json(isOnline);
        } catch (error) {
            console.error('Error checking online db_type:', error);
            return res.status(500).json(false);
        }
    }
};

module.exports = dbOnlineCheckController;
