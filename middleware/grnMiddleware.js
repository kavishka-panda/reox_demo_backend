const { AppError } = require('./errorHandler');

/**
 * Validates GRN creation data
 */
exports.validateGRN = (req, res, next) => {
    const { billNumber, supplierId, items, paidAmount, grandTotal, paymentMethodId } = req.body;

    console.log("Validating GRN data:", { billNumber, supplierId, items, paidAmount, grandTotal, paymentMethodId });
    // 1. Basic Bill Validation
    if (!billNumber || billNumber.trim() === "") return next(new AppError("Bill number is required", 400));
    if (!supplierId || isNaN(supplierId)) return next(new AppError("Please select a valid supplier", 400));
    if (!items || !Array.isArray(items) || items.length === 0) {
        return next(new AppError("At least one product item is required", 400));
    }

    // 2. Validate Each Item in the GRN
    for (const [index, item] of items.entries()) {
        const itemLabel = `Item ${index + 1}`;

        // Mandatory Fields Check
        if (!item.variantId || isNaN(item.variantId)) {
            return next(new AppError(`${itemLabel}: Product variant is required`, 400));
        }
        if (!item.batchIdentifier || item.batchIdentifier.trim() === "") {
            return next(new AppError(`${itemLabel}: Batch number is required`, 400));
        }
        if (!item.barcode || item.barcode.trim() === "") {
            return next(new AppError(`${itemLabel}: Barcode is required`, 400));
        }
        
        // Number Validation (Numbers and Greater than 0)
        if (isNaN(item.costPrice) || parseFloat(item.costPrice) <= 0) {
            return next(new AppError(`${itemLabel}: Valid Cost Price is required`, 400));
        }
        if (isNaN(item.mrp) || parseFloat(item.mrp) <= 0) {
            return next(new AppError(`${itemLabel}: Valid MRP is required`, 400));
        }
        if (isNaN(item.rsp) || parseFloat(item.rsp) <= 0) {
            return next(new AppError(`${itemLabel}: Valid Retail Selling Price is required`, 400));
        }
        if (isNaN(item.qty) || parseInt(item.qty) <= 0) {
            return next(new AppError(`${itemLabel}: Valid Quantity is required`, 400));
        }

        // Optional WSP validation (if provided, must be valid)
        if (item.wsp && (isNaN(item.wsp) || parseFloat(item.wsp) < 0)) {
            return next(new AppError(`${itemLabel}: Wholesale price must be a valid positive number`, 400));
        }

        // Optional free quantity validation (if provided, must be non-negative)
        if (item.freeQty && (isNaN(item.freeQty) || parseInt(item.freeQty) < 0)) {
            return next(new AppError(`${itemLabel}: Free quantity must be a non-negative number`, 400));
        }

        // Date validation (if provided, check format)
        if (item.mfd && item.mfd.trim() !== "" && isNaN(Date.parse(item.mfd))) {
            return next(new AppError(`${itemLabel}: Manufacturing date must be a valid date`, 400));
        }
        if (item.exp && item.exp.trim() !== "" && isNaN(Date.parse(item.exp))) {
            return next(new AppError(`${itemLabel}: Expiry date must be a valid date`, 400));
        }

        // Check if expiry date is after manufacturing date
        if (item.mfd && item.exp && item.mfd.trim() !== "" && item.exp.trim() !== "") {
            const mfdDate = new Date(item.mfd);
            const expDate = new Date(item.exp);
            if (expDate <= mfdDate) {
                return next(new AppError(`${itemLabel}: Expiry date must be after manufacturing date`, 400));
            }
        }
    }

    // 3. Payment Validation
    if (isNaN(grandTotal) || parseFloat(grandTotal) <= 0) {
        return next(new AppError("Grand total must be a positive number", 400));
    }
    if (paidAmount !== undefined && paidAmount !== null && paidAmount !== '') {
        if (isNaN(paidAmount) || parseFloat(paidAmount) < 0) {
            return next(new AppError("Paid amount must be a non-negative number", 400));
        }
        if (parseFloat(paidAmount) > parseFloat(grandTotal)) {
            return next(new AppError("Paid amount cannot exceed grand total", 400));
        }
        if (parseFloat(paidAmount) > 0 && (!paymentMethodId || isNaN(paymentMethodId))) {
            return next(new AppError("Please select a payment method when providing paid amount", 400));
        }
    }

    next();
};