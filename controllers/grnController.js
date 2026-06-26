const Grn = require("../models/grnModel");
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../middleware/errorHandler");

exports.saveGRN = catchAsync(async (req, res, next) => {
    const grnId = await Grn.createGRN(req.body);
    
    res.status(201).json({
        success: true,
        message: "GRN successfully processed and stock updated!",
        grnId: grnId
    });
});

exports.getStats = catchAsync(async (req, res, next) => {
    const stats = await Grn.getGRNSummary();
    
    res.status(200).json({
        success: true,
        data: {
            totalGrn: stats.totalGrnCount || 0,
            totalAmount: stats.totalAmount || 0,
            totalPaid: stats.totalPaid || 0,
            totalBalance: stats.totalBalance || 0
        }
    });
});

exports.getGRNList = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Grn.getAllGRNs(page, limit);
    
    res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
    });
});


exports.searchGRNList = catchAsync(async (req, res, next) => {
    const { supplierName, fromDate, toDate, billNumber, page, limit } = req.query;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    const result = await Grn.searchGRNs({
        supplierName,
        fromDate,
        toDate,
        billNumber
    }, pageNum, limitNum);

    res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
    });
});

exports.getSupplierBills = catchAsync(async (req, res, next) => {
    const { supplier_id } = req.params;

    if (!supplier_id) {
        return res.status(400).json({
            success: false,
            message: "Supplier ID is required"
        });
    }

    const bills = await Grn.getActiveBillNumbersBySupplier(supplier_id);

    res.status(200).json({
        success: true,
        count: bills.length,
        data: bills
    });
});

exports.processPayment = catchAsync(async (req, res, next) => {
    const { grn_id, payment_amount, payment_type_id } = req.body;

    // English Comments: Basic check for input values
    if (!grn_id || !payment_amount || !payment_type_id) {
        return res.status(400).json({
            success: false,
            message: "Please provide GRN ID, payment amount and payment type."
        });
    }

    try {
        const result = await Grn.updatePayment({
            grn_id,
            payment_amount,
            payment_type_id
        });

        res.status(200).json({
            success: true,
            message: "Payment processed successfully.",
            balance: result.remainingBalance
        });
    } catch (error) {
        // English Comments: Sends the specific validation error (e.g., amount exceeded) back to UI
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

exports.getGRNDetails = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: "GRN ID is required"
        });
    }

    const grn = await Grn.getGRNDetailsById(id);

    if (!grn) {
        return res.status(404).json({
            success: false,
            message: "GRN not found"
        });
    }

    res.status(200).json({
        success: true,
        data: grn
    });
});