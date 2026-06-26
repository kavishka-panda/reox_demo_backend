const Reason = require('../models/reasonModel');

exports.getReasonList = async (req, res) => {
    try {
        const reasons = await Reason.getAllReasons();
        
        res.status(200).json({
            success: true,
            count: reasons.length,
            data: reasons
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Reasons retrieval failed",
            error: error.message
        });
    }
};