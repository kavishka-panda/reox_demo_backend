const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Route to get ALL stock data with individual variations (every row in stock table)
router.get('/all-variations', stockController.getAllStockWithVariations);

// Route to get stock data for the UI table (grouped by product)
router.get('/', stockController.getStockList);
router.get('/search', stockController.getSearchStock);
router.get('/summary-cards', stockController.getSummaryCards);
router.get('/out-of-stock', stockController.getOutOfStockList);
router.get('/out-of-stock/search', stockController.getSearchOutOfStock);
router.get('/out-of-stock/summary', stockController.getOutOfStockDashboardSummary);
router.get('/get-stock-by-variant/:variationId', stockController.getStockForProduct);
router.get('/expire-stock', stockController.getExpireStockList);
router.get('/low-stock', stockController.getLowStockList);
router.get('/low-stock/search', stockController.getFilteredLowStock);
router.get('/low-stock/summary', stockController.getLowStockDashboardSummary);

module.exports = router;

