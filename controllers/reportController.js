const Report = require("../models/reportModel");

const getFilteredReport = async (req, res) => {
    try {
        const filter = {
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            reportType: req.query.reportType || 'daily'
        };

        const reportData = await Report.getFilteredReport(filter);

        res.json({
            success: true,
            data: reportData
        });
    } catch (error) {
        console.error('Error in getFilteredReport:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filtered report data'
        });
    }
};

const getDetailedDashboard = async (req, res) => {
    try {
        const stats = await Report.getDashboardStats();
        const sessionTrend = await Report.getSessionTrend();

        res.json({
            success: true,
            data: {
                stats,
                sessionTrend
            }
        });
    } catch (error) {
        console.error('Error in getDetailedDashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch detailed dashboard data'
        });
    }
};

module.exports = {
    getFilteredReport,
    getDetailedDashboard
};
