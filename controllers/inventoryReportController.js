const inventoryReportModel = require("../models/inventoryReportModel");
const { isValidDate } = require('../utils/validators');

const getInventoryCard = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        // Validate dates if provided
        if (fromDate && !isValidDate(fromDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid fromDate format. Use YYYY-MM-DD.',
            });
        }

        if (toDate && !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid toDate format. Use YYYY-MM-DD.',
            });
        }

        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate cannot be after toDate.',
            });
        }

        const data = await inventoryReportModel.getInventoryCardData(fromDate, toDate);

        res.json({
            success: true,
            data: data,
        });
    } catch (error) {
        console.error("Error fetching inventory card data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load inventory card",
        });
    }
};

const getTopPerformingProducts = async (req, res) => {
    try {
        const { fromDate, toDate, limit } = req.query;

        // Validate dates if provided
        if (fromDate && !isValidDate(fromDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid fromDate format. Use YYYY-MM-DD.',
            });
        }

        if (toDate && !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid toDate format. Use YYYY-MM-DD.',
            });
        }

        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate cannot be after toDate.',
            });
        }

        const limitValue = Math.min(parseInt(limit) || 10, 100);

        const data = await inventoryReportModel.getTopPerformingProducts(fromDate, toDate, limitValue);

        res.json({
            success: true,
            data: data,
        });
    } catch (error) {
        console.error("Error fetching top performing products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load top performing products",
        });
    }
};

const getSlowMovingProducts = async (req, res) => {
    try {
        const { fromDate, toDate, limit } = req.query;

        // Validate dates if provided
        if (fromDate && !isValidDate(fromDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid fromDate format. Use YYYY-MM-DD.',
            });
        }

        if (toDate && !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid toDate format. Use YYYY-MM-DD.',
            });
        }

        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate cannot be after toDate.',
            });
        }

        const limitValue = Math.min(parseInt(limit) || 10, 100);

        const data = await inventoryReportModel.getSlowMovingProducts(fromDate, toDate, limitValue);

        res.json({
            success: true,
            data: data,
        });
    } catch (error) {
        console.error("Error fetching slow moving products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load slow moving products",
        });
    }
};

const getCriticalReorderList = async (req, res) => {
    try {
        const data = await inventoryReportModel.getCriticalReorderList();

        res.json({
            success: true,
            data: data,
        });
    } catch (error) {
        console.error("Error fetching critical reorder list:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load critical reorder list",
        });
    }
};

const getProductProfitabilityAnalysis = async (req, res) => {
    try {
        const { limit, offset } = req.query;

        const limitValue = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
        const offsetValue = Math.max(parseInt(offset) || 0, 0);

        const result = await inventoryReportModel.getProductProfitabilityAnalysis(limitValue, offsetValue);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("Error fetching product profitability analysis:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load product profitability analysis",
        });
    }
};

module.exports = {
    getInventoryCard,
    getTopPerformingProducts,
    getSlowMovingProducts,
    getCriticalReorderList,
    getProductProfitabilityAnalysis,
};
