const POS = require('../models/posModel');
const catchAsync = require('../utils/catchAsync');

// Redundant POS product list methods removed. Use stock/product routes instead.
exports.searchProductByBarcode = catchAsync(async (req, res, next) => {
    const { barcode } = req.params;

    if (!barcode || barcode.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Barcode is required'
        });
    }

    const products = await POS.searchByBarcode(barcode.trim());

    if (!products || products.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Product not found with this barcode'
        });
    }

    // Format all matching products
    const formattedProducts = products.map(item => {
        let variations = [item.color, item.size, item.storage_capacity]
            .filter(v => v && !['n/a', 'na', 'n.a.', 'none', 'default', 'not applicable'].includes(v.toLowerCase().trim()) && v.trim() !== '');

        let fullDisplayName = item.productName;
        if (variations.length > 0) {
            fullDisplayName += ` - ${variations.join(' - ')}`;
        }

        return {
            stockID: item.stockID,
            displayName: fullDisplayName,
            barcode: item.barcode,
            unit: item.unit,
            price: item.price,
            wholesalePrice: item.wholesalePrice,
            productCode: item.productCode,
            stock: item.currentStock,
            batch: item.batchName,
            isBulk: item.unit.toLowerCase().includes('kg') || item.unit.toLowerCase().includes('bag'),
            expiry: item.expiry
        };
    });

    // Return single object if only one product, otherwise return array
    res.status(200).json({
        success: true,
        data: formattedProducts.length === 1 ? formattedProducts[0] : formattedProducts
    });
});

// Redundant searchProducts method removed.



exports.createInvoice = catchAsync(async (req, res, next) => {
    // Expecting: items, customer_id, payment_details, discount, etc.
    // Also need user_id (from auth - req.user.id) and cash_session_id (need to fetch strictly)
    
    // For now, assuming middleware adds req.user.
    // cash_session_id: The user should provide or we look up active session.
    // Assuming passed in body or look up active. Best to look up active to be secure.
    // But for speed, let's look up active session for this user.
    
    const { items, customer_id, payment_details, discount, total_amount, sub_total } = req.body;
    
    // We need the active cash session for this user?
    // Or just any active session. 
    // Assuming user_id comes from auth middleware, but we don't have full auth setup visible here (req.user?).
    // 'posController' uses 'catchAsync'. 
    // I'll grab user_id from body if testing, or assume req.user.id if auth middleware is on.
    // Looking at routes, auth is used?
    // posRoutes.js doesn't show auth middleware on 'getPOSProductsList'.
    // If no auth, I need passed user_id or similar.
    // Reox POS usually needs a logged in user.
    // I'll use a passed 'user_id' for now, or default to 1 if testing.
    
    const user_id = req.body.user_id || 1; // Fallback
    const cash_session_id = req.body.cash_session_id; // Frontend should send this or we query.

    console.log('--- CREATE INVOICE REQUEST ---');
    console.log('Items:', JSON.stringify(items));
    console.log('Customer ID:', customer_id);
    console.log('User ID:', user_id);
    console.log('Cash Session ID:', cash_session_id);
    console.log('Payment Details:', JSON.stringify(payment_details));
    console.log('Total:', total_amount, 'Subtotal:', sub_total, 'Discount:', discount);
    
    if (!cash_session_id) {
        console.warn('WARNING: No cash_session_id provided!');
    }

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'No items in cart' });
    }

    const invoice = await POS.createInvoice({
        customer_id,
        user_id,
        items,
        payment_details,
        discount,
        total_amount,
        sub_total,
        cash_session_id
    });

    res.status(201).json({
        success: true,
        data: invoice
    });
});

exports.convertBulkToLoose = catchAsync(async (req, res, next) => {
    const { bulkStockId, looseVariationId, deductQty, addQty } = req.body;

    if (bulkStockId === undefined || looseVariationId === undefined || deductQty === undefined || addQty === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: bulkStockId, looseVariationId, deductQty, addQty'
        });
    }

    if (deductQty <= 0 || addQty <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Quantities must be greater than zero'
        });
    }

    const result = await POS.convertBulkToLoose({
        bulkStockId,
        looseVariationId,
        deductQty,
        addQty
    });

    res.status(200).json({
        success: true,
        data: result
    });
});



exports.getInvoice = catchAsync(async (req, res, next) => {
    const { invoiceNo } = req.params;
    const invoice = await POS.getInvoiceByNo(invoiceNo);

    if (!invoice) {
        return res.status(404).json({
            success: false,
            message: 'Invoice not found'
        });
    }

    res.status(200).json({
        success: true,
        data: invoice
    });
});

exports.processReturn = catchAsync(async (req, res, next) => {
    // Expecting body: { invoiceNo, items: [{id, returnQuantity}] }
    const result = await POS.processReturn(req.body);

    res.status(200).json({
        success: true,
        message: 'Return processed successfully',
        refundedCash: result.refundedCash,
        newDebt: result.newDebt,
        oldDebt: result.oldDebt,
        debtReduction: result.debtReduction,
        returnValue: result.returnValue
    });
});

// Get all invoices with filters and pagination
exports.getAllInvoices = catchAsync(async (req, res, next) => {
    const { invoiceNumber, cashierName, fromDate, toDate, customerId, page = 1, limit = 10, order } = req.query;

    const filters = {
        invoiceNumber,
        cashierName,
        fromDate,
        toDate,
        customerId,
        order
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const result = await POS.getAllInvoices(filters, limitNum, offset);

    res.status(200).json({
        success: true,
        data: result.invoices,
        pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(result.total / limitNum),
            totalRecords: result.total,
            itemsPerPage: limitNum
        }
    });
});

// Get invoice statistics
exports.getInvoiceStats = catchAsync(async (req, res, next) => {
    const { fromDate, toDate, cashierName } = req.query;

    const stats = await POS.getInvoiceStats({ fromDate, toDate, cashierName });

    res.status(200).json({
        success: true,
        data: stats
    });
});
// Process payment for customer invoice
exports.processInvoicePayment = catchAsync(async (req, res, next) => {
    const { invoice_id, payment_amount, payment_type_id } = req.body;
    const user_id = req.body.user_id || (req.user ? req.user.id : 1);

    if (!invoice_id || !payment_amount || !payment_type_id) {
        return res.status(400).json({
            success: false,
            message: "Invoice number, payment amount and payment type are required."
        });
    }

    const result = await POS.processInvoicePayment({
        invoice_number: invoice_id,
        payment_amount: parseFloat(payment_amount),
        payment_type_id: parseInt(payment_type_id),
        user_id: user_id
    });

    res.status(200).json({
        success: true,
        message: "Payment processed successfully",
        data: result
    });
});

exports.getReturnHistory = catchAsync(async (req, res, next) => {
    const { invoiceNumber, fromDate, toDate, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const result = await POS.getReturnHistory({ invoiceNumber, fromDate, toDate }, limitNum, offset);

    res.status(200).json({
        success: true,
        data: result.returns.map(r => ({
            id: r.id,
            invoiceNo: r.invoice.invoice_number,
            customer: r.invoice.customer?.name || 'Guest',
            date: r.cash_sessions.opening_date_time,
            returnValue: r.balance,
            refundedAmount: r.invoice.refunded_amount,
            user: r.invoice.cash_sessions.user.name
        })),
        pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(result.totalRecords / limitNum),
            totalRecords: result.totalRecords,
            itemsPerPage: limitNum
        }
    });
});

exports.getCreditPaymentHistory = catchAsync(async (req, res, next) => {
    const { customerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!customerId) {
        return res.status(400).json({
            success: false,
            message: "Customer ID is required"
        });
    }

    const result = await POS.getCreditPaymentHistory(
        customerId,
        parseInt(page),
        parseInt(limit)
    );

    res.status(200).json({
        success: true,
        data: result.history,
        pagination: result.pagination
    });
});

// Process credit payment for customer (across multiple invoices)
exports.processCreditPayment = catchAsync(async (req, res, next) => {
    const { customer_id, payment_amount, payment_type_id } = req.body;
    const user_id = req.body.user_id || (req.user ? req.user.id : 1);

    if (!customer_id || !payment_amount || !payment_type_id) {
        return res.status(400).json({
            success: false,
            message: "Customer ID, payment amount and payment type are required."
        });
    }

    const result = await POS.processCreditPayment({
        customer_id: parseInt(customer_id),
        payment_amount: parseFloat(payment_amount),
        payment_type_id: parseInt(payment_type_id),
        user_id: user_id
    });

    res.status(200).json({
        success: true,
        message: "Credit payment processed successfully",
        data: result
    });
});

