const Stock = require('../models/stockModel');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Fetch ALL stock records with individual variations (every row)
 * @route   GET /api/stock/all-variations
 */
/**
 * @desc    Fetch ALL stock records with individual variations (every row)
 * @route   GET /api/stock/all-variations
 */
exports.getAllStockWithVariations = catchAsync(async (req, res, next) => {
    const { hasStock, limit } = req.query;
    const stockData = await Stock.getAllStockWithVariations({ 
        hasStock: hasStock === 'true',
        limit: limit
    });

    // Transform data for variation list (e.g. POS, Stock List)
    const transformedData = stockData.map(item => {
        const unitLabel = (item.unit || '').toLowerCase();
        const isBulk = unitLabel.includes('kg') || 
                      unitLabel.includes('bag') || 
                      unitLabel.includes('bundle') || 
                      unitLabel.includes('box') || 
                      unitLabel.includes('carton') || 
                      unitLabel.includes('pk');

        return {
            stockID: item.stock_id,
            variationID: item.product_variations_id,
            productID: item.product_code || item.product_id.toString(),
            productName: item.full_product_name,
            barcode: item.barcode || 'N/A',
            unit: item.unit,
            unit_conversion: item.unit_conversion,
            isBulk: isBulk,
            costPrice: parseFloat(item.cost_price || 0).toFixed(2),
            MRP: parseFloat(item.mrp || 0).toFixed(2),
            Price: parseFloat(item.selling_price || 0).toFixed(2),
            wholesalePrice: parseFloat(item.wsp || 0).toFixed(2),
            supplier: item.supplier || 'N/A',
            stockQty: (item.qty || 0).toString(),
            batch: item.batch_name,
            mfd: item.mfd,
            exp: item.exp,
            color: item.color,
            size: item.size,
            storage: item.storage_capacity,
            category: item.category,
            brand: item.brand
        };
    });

    res.status(200).json({
        success: true,
        count: transformedData.length,
        data: transformedData
    });
});

/**
 * @desc    Fetch all stock records for the table (grouped by product)
 * @route   GET /api/stock
 */
exports.getStockList = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Stock.getAllStock(page, limit);

    // Transform data to match frontend expectations
    const transformedData = result.data.map(item => ({
        stockID: item.stock_id,
        variationID: item.product_variations_id,
        productID: item.product_code || item.product_id.toString(),
        productName: item.full_product_name,
        barcode: item.barcode || 'N/A',
        unit: item.unit,
        costPrice: typeof item.cost_price === 'number' ? item.cost_price.toFixed(2) : parseFloat(item.cost_price).toFixed(2),
        MRP: typeof item.mrp === 'number' ? item.mrp.toFixed(2) : parseFloat(item.mrp).toFixed(2),
        Price: typeof item.selling_price === 'number' ? item.selling_price.toFixed(2) : parseFloat(item.selling_price).toFixed(2),
        supplier: item.supplier || 'N/A',
        stockQty: item.stock_qty ? item.stock_qty.toString() : item.qty.toString(),
        category: item.category,
        brand: item.brand,
        mfd: item.mfd,
        exp: item.exp,
        batch_name: item.batch_name
    }));

    res.status(200).json({
        success: true,
        data: transformedData,
        pagination: result.pagination
    });
});

exports.getSearchStock = catchAsync(async (req, res, next) => {
    try {
        const filters = {
            category: req.query.category,
            unit: req.query.unit,
            supplier: req.query.supplier,
            searchQuery: req.query.q,
            limit: req.query.limit
        };
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await Stock.searchStock(filters, page, limit);
       
        const transformedData = result.data.map(item => {
            const unitLabel = (item.unit || '').toLowerCase();
            const isBulk = unitLabel.includes('kg') || 
                          unitLabel.includes('bag') || 
                          unitLabel.includes('bundle') || 
                          unitLabel.includes('box') || 
                          unitLabel.includes('carton') || 
                          unitLabel.includes('pk');

            return {
                stockID: item.stock_id,
                variationID: item.product_variations_id,
                productID: item.product_code || item.product_id.toString(),
                productName: item.full_product_name,
                barcode: item.barcode || 'N/A',
                unit: item.unit,
                isBulk: isBulk,
                costPrice: typeof item.cost_price === 'number' ? item.cost_price.toFixed(2) : parseFloat(item.cost_price || 0).toFixed(2),
                MRP: typeof item.mrp === 'number' ? item.mrp.toFixed(2) : parseFloat(item.mrp || 0).toFixed(2),
                Price: typeof item.selling_price === 'number' ? item.selling_price.toFixed(2) : parseFloat(item.selling_price || 0).toFixed(2),
                wholesalePrice: typeof item.wsp === 'number' ? item.wsp.toFixed(2) : parseFloat(item.wsp || 0).toFixed(2),
                supplier: item.supplier || 'N/A',
                stockQty: item.stock_qty ? item.stock_qty.toString() : (item.qty || 0).toString(),
                color: item.color,
                size: item.size,
                storage: item.storage_capacity,
                category: item.category,
                brand: item.brand,
                mfd: item.mfd,
                exp: item.exp,
                batch_name: item.batch_name
            };
        });

        res.status(200).json({
            success: true,
            data: transformedData,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error in getSearchStock:', error);
        throw error;
    }
});

exports.getSummaryCards = catchAsync(async (req, res, next) => {
    const summary = await Stock.getDashboardSummary();

    res.status(200).json({
        success: true,
        data: {
            totalProducts: {
                value: summary.totalProducts.toLocaleString(),
                trend: "+5%"
            },
            totalValue: {
                value: `LKR ${parseFloat(summary.totalValue).toLocaleString(undefined, {minimumFractionDigits: 2})}`,
                trend: "+8%"
            },
            lowStock: {
                value: summary.lowStock.toString(),
                trend: "-5%"
            },
            totalSuppliers: {
                value: summary.totalSuppliers.toString(),
                trend: "+3%"
            },
            totalCategories: {
                value: summary.totalCategories.toString(),
                trend: "+2%"
            }
        }
    });
});

exports.getOutOfStockList = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Stock.getOutOfStock(page, limit);

    const transformedData = result.data.map(item => ({
        pvId: item.product_variations_id,
        productID: item.product_code || (item.product_id ? item.product_id.toString() : 'N/A'),
        productName: item.product_name,
        unit: item.unit,
        costPrice: `LKR ${parseFloat(item.cost_price || 0).toFixed(2)}`,
        MRP: `LKR ${parseFloat(item.mrp || 0).toFixed(2)}`,
        Price: `LKR ${parseFloat(item.selling_price || 0).toFixed(2)}`,
        supplier: item.supplier || 'N/A',
        stockQty: (item.stock_qty ?? item.qty ?? 0).toString()
    }));

    res.status(200).json({
        success: true,
        data: transformedData,
        pagination: result.pagination
    });
});

exports.getSearchOutOfStock = catchAsync(async (req, res, next) => {
    const filters = {
        searchQuery: req.query.product,
        category: req.query.category,
        supplier: req.query.supplier,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate
    };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await Stock.searchOutOfStock(filters, page, limit);

    const transformedData = result.data.map(item => ({
        pvId: item.product_variations_id,
        productID: item.product_code || (item.product_id ? item.product_id.toString() : 'N/A'),
        productName: item.product_name,
        unit: item.unit,
        costPrice: `LKR ${parseFloat(item.cost_price || 0).toFixed(2)}`,
        MRP: `LKR ${parseFloat(item.mrp || 0).toFixed(2)}`,
        Price: `LKR ${parseFloat(item.selling_price || 0).toFixed(2)}`,
        supplier: item.supplier || 'N/A',
        stockQty: (item.stock_qty ?? item.qty ?? 0).toString()
    }));

    res.status(200).json({
        success: true,
        data: transformedData,
        pagination: result.pagination,
        message: transformedData.length === 0 
            ? 'No out-of-stock items found' 
            : `Found ${transformedData.length} items`
    });
});

exports.getStockForProduct = catchAsync(async (req, res, next) => {
    const { variationId } = req.params;

    if (!variationId) {
        return res.status(400).json({ success: false, message: "Product Variation ID is required" });
    }

    const stockItems = await Stock.getStockByProductVariation(variationId);

    const transformedData = stockItems.map(item => ({
        stockID: item.stock_id,
        displayName: item.full_stock_display,
        quantity: item.available_qty,
        price: item.selling_price
    }));

    res.status(200).json({
        success: true,
        data: transformedData
    });
});

exports.getExpireStockList = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 15;

    const result = await Stock.getExpireStockRecords(page, limit, days);

    const transformedData = result.data.map(item => ({
        stockID: item.stock_id,
        variationID: item.product_variations_id,
        productID: item.product_code || item.product_id.toString(),
        productName: item.full_product_name,
        barcode: item.barcode || 'N/A',
        unit: item.unit,
        costPrice: typeof item.cost_price === 'number' ? item.cost_price.toFixed(2) : parseFloat(item.cost_price || 0).toFixed(2),
        MRP: typeof item.mrp === 'number' ? item.mrp.toFixed(2) : parseFloat(item.mrp || 0).toFixed(2),
        Price: typeof item.selling_price === 'number' ? item.selling_price.toFixed(2) : parseFloat(item.selling_price || 0).toFixed(2),
        supplier: item.supplier || 'N/A',
        stockQty: (item.qty || 0).toString(),
        category: item.category,
        brand: item.brand,
        batch_name: item.batch_name,
        mfd: item.mfd,
        exp: item.exp
    }));

    res.status(200).json({
        success: true,
        data: transformedData,
        pagination: result.pagination
    });
});

exports.getLowStockList = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Stock.getLowStockRecords(page, limit);

    const formattedData = result.data.map(item => {
        // Determine status label based on quantity
        let statusLabel = item.available_qty <= 5 ? 'Critical' : 'Low';

        return {
            productID: item.pvId,
            productName: item.product_name,
            unit: item.unit,
            costPrice: item.cost_price,
            mrp: item.mrp,
            price: item.selling_price,
            supplier: item.supplier,
            stockStatus: `${item.available_qty} units - ${statusLabel}`
        };
    });

    res.status(200).json({
        success: true,
        data: formattedData,
        pagination: result.pagination
    });
});

exports.getFilteredLowStock = catchAsync(async (req, res, next) => {
    // Extracting IDs from the request query object
    const { category_id, unit_id, supplier_id, product_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await Stock.searchLowStock({
        category_id,
        unit_id,
        supplier_id,
        product_id
    }, page, limit);

    //Formats data to match the UI table requirements
    const tableData = result.data.map(item => ({
        productID: item.pvId,
        productName: item.product_name,
        unit: item.unit,
        discount: "LKR 0.00", 
        costPrice: item.cost_price,
        mrp: item.mrp,
        price: item.selling_price,
        supplier: item.supplier,
        // Status logic based on quantity
        stockStatus: `${item.available_qty} units - ${item.available_qty <= 5 ? 'Critical' : 'Low'}`
    }));

    res.status(200).json({
        success: true,
        data: tableData,
        pagination: result.pagination
    });
});

exports.getOutOfStockDashboardSummary = catchAsync(async (req, res, next) => {
    const summary = await Stock.getOutOfStockSummary();

    res.status(200).json({
        success: true,
        data: {
            totalProducts: summary.total_out_of_stock_products || 0,
            avgDaysOut: summary.avg_days_out || 0,
            affectedSuppliers: summary.affected_suppliers || 0
        }
    });
});

exports.getLowStockDashboardSummary = catchAsync(async (req, res, next) => {
    const summary = await Stock.getLowStockSummary();

    res.status(200).json({
        success: true,
        data: {
            // English Comments: Matches "Low Stock Items" card
            lowStockItems: summary.low_stock_items_count || 0,
            
            // English Comments: Matches "Total Products" card
            totalProducts: summary.total_products_count || 0,
            
            // English Comments: Formatting currency for "Potential Loss"
            potentialLoss: `LKR ${(summary.potential_loss_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            
            // English Comments: Matches "Below Threshold" card
            belowThreshold: summary.below_threshold_count || 0,
            
            // English Comments: Matches "Reorder Required" card
            reorderRequired: summary.reorder_required_count || 0
        }
    });
});