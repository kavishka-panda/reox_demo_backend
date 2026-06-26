const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const salesReportController = require("../controllers/salesReportController");
const inventoryReportController = require("../controllers/inventoryReportController");

router.get("/dashboard-detailed", reportController.getDetailedDashboard);
router.get("/filter", reportController.getFilteredReport);

router.get("/sales/card", salesReportController.getSalesCard);
router.get("/sales/transaction-ledger", salesReportController.getTransactionLedger);
router.get("/z-report", salesReportController.getZReport);
router.get("/sales/today-trend", salesReportController.getTodaysSalesTrend);
router.get("/sales/recent-sessions", salesReportController.getRecentSessionsHistory);

router.get("/inventory/card", inventoryReportController.getInventoryCard);
router.get("/inventory/top-products", inventoryReportController.getTopPerformingProducts);
router.get("/inventory/slow-moving", inventoryReportController.getSlowMovingProducts);
router.get("/inventory/critical-reorder", inventoryReportController.getCriticalReorderList);
router.get("/inventory/profitability", inventoryReportController.getProductProfitabilityAnalysis);

module.exports = router;
