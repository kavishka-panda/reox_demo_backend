const Damaged = require('../models/damagedModel');
const catchAsync = require('../utils/catchAsync'); 

exports.createDamagedRecord = catchAsync(async (req, res, next) => {
    const { stock_id, qty, reason_id, description, status_id } = req.body;

    // Basic validation for required fields
    if (!stock_id || !qty || !reason_id || !status_id) {
        return res.status(400).json({
            success: false,
            message: "All required fields must be provided."
        });
    }

    try {
        // Attempt to add damaged record and update stock
        await Damaged.addDamagedStock({
            stock_id,
            qty,
            reason_id,
            description: description || "N/A",
            status_id
        });

        res.status(201).json({
            success: true,
            message: "Damaged record added and stock updated successfully."
        });
    } catch (error) {
        // Return the specific error message (e.g., "Insufficient stock") to the frontend
        res.status(400).json({
            success: false,
            message: error.message 
        });
    }
});

exports.getDamagedTableData = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Fetch data from model with pagination
    const result = await Damaged.getAllDamagedRecords(page, limit);

    // Map data to match your UI table columns
    const tableData = result.data.map(record => ({
        productID: record.product_id_code,
        productName: record.product_name,
        unit: record.unit,
        costPrice: record.cost_price,
        mrp: record.mrp,
        price: record.price,
        supplier: record.supplier,
        stockStatus: record.stock_label, // Shown as Batch #001 in UI
        damagedQty: record.damaged_qty,
        reason: record.damage_reason,
        status: record.status,
        id: record.damaged_id,
        description: record.description,
        date: record.date
    }));

    res.status(200).json({
        success: true,
        data: tableData,
        pagination: result.pagination
    });
});

exports.searchDamaged = catchAsync(async (req, res, next) => {
    //Get product name and dates from the request query string
    const { productName, fromDate, toDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await Damaged.searchDamagedRecords({
        productName,
        fromDate,
        toDate
    }, page, limit);

    const transformedResults = result.data.map(record => ({
        productID: record.product_id_code,
        productName: record.product_name,
        unit: record.unit,
        costPrice: record.cost_price,
        mrp: record.mrp,
        price: record.price,
        supplier: record.supplier,
        stockStatus: record.stock_label,
        damagedQty: record.damaged_qty,
        reason: record.damage_reason,
        status: record.status,
        id: record.damaged_id,
        description: record.description,
        date: record.date
    }));

    res.status(200).json({
        success: true,
        count: result.pagination.totalItems,
        data: transformedResults,
        pagination: result.pagination
    });
});


exports.getDamagedDashboardSummary = catchAsync(async (req, res, next) => {
    const summary = await Damaged.getDamagedSummary();

    res.status(200).json({
        success: true,
        data: {
            damagedItems: summary.damaged_items_count || 0,
            totalProducts: summary.total_products_affected || 0,
            // English Comments: Formatting the loss value as currency string
            lossValue: `LKR ${(summary.total_loss_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            thisMonth: summary.this_month_count || 0,
            affectedSuppliers: summary.affected_suppliers_count || 0
        }
    });
});

exports.updateDamagedStatus = catchAsync(async (req, res, next) => {
    const { id, status_id } = req.body;

    if (!id || !status_id) {
        return res.status(400).json({
            success: false,
            message: "Damage ID and Status ID are required."
        });
    }

    await Damaged.updateStatus(id, status_id);

    res.status(200).json({
        success: true,
        message: "Damaged status updated successfully."
    });
});