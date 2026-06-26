const ReturnStatus = require('../models/returnStatusModel');

exports.getReturnStatusList = async (req, res) => {
    try {
        const returnStatuses = await ReturnStatus.getAllReturnStatuses();
        
        res.status(200).json({
            success: true,
            count: returnStatuses.length,
            data: returnStatuses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Return status data retrieval failed",
            error: error.message
        });
    }
};