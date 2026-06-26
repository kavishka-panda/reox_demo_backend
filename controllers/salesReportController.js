const salesReportModel = require("../models/salesReportModel");
const { isValidDate, isValidPositiveInt, isValidLimit } = require('../utils/validators');

const getSalesCard = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        
         if (!isValidDate(fromDate) || !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD.',
            });
        }
        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate cannot be after toDate.',
            });
        }

        const data = await salesReportModel.getSalesCardData(fromDate, toDate);
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error("Error fetching sales card data:", error);
        res.status(500).json({ success: false, message: "Failed to load sales card" });
    }
};

const getTransactionLedger = async (req, res) => {
    try {
        const { fromDate, toDate, page, limit } = req.query;

        if (!isValidDate(fromDate) || !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD.',
            });
        }
        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate cannot be after toDate.',
            });
        }

        const data = await salesReportModel.getTransactionLedger(fromDate, toDate, page, limit);
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error("Error fetching transaction ledger data:", error);
        res.status(500).json({ success: false, message: "Failed to load transaction ledger" });
    }
};

const getZReport = async (req, res) => {
    try {
        const { fromDate, toDate, counter_id } = req.query;

        // Validate dates if provided
        if (fromDate && !isValidDate(fromDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid fromDate format. Use YYYY-MM-DD.'
            });
        }

        if (toDate && !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid toDate format. Use YYYY-MM-DD.'
            });
        }

        // Validate date range
        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate cannot be after toDate.'
            });
        }

        const zReport = await salesReportModel.getZReportData(fromDate, toDate, counter_id);

        res.json({
            success: true,
            data: zReport
        });
    } catch (error) {
        console.error('Error fetching Z-Report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load Z-Report'
        });
    }
};

const getTodaysSalesTrend = async (req, res) => {
    try {
        const trend = await salesReportModel.getTodaysSalesTrend();

        res.json({
            success: true,
            data: trend
        });
    } catch (error) {
        console.error('Error fetching today\'s sales trend:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load today\'s sales trend'
        });
    }
};

const getRecentSessionsHistory = async (req, res) => {
    try {
        const history = await salesReportModel.getRecentSessionsHistory();

        res.json({
            success: true,
            data: history.data
        });
    } catch (error) {
        console.error('Error fetching recent sessions history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load recent sessions history'
        });
    }
};

module.exports = {
    getSalesCard,
    getTransactionLedger,
    getZReport,
    getTodaysSalesTrend,
    getRecentSessionsHistory
};
