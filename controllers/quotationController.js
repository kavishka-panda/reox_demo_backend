const Quotation = require('../models/quotationModel');
const catchAsync = require('../utils/catchAsync');

exports.createQuotation = catchAsync(async (req, res, next) => {
    const { customer_id, user_id, items, sub_total, discount, total, valid_until } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'No items provided' });
    }

    const quotation = await Quotation.create({
        customer_id: customer_id ? parseInt(customer_id) : null,
        user_id: user_id ? parseInt(user_id) : 1, // Default to user 1 for now if not authenticated
        items,
        sub_total,
        discount, // total global discount not item level, but we summed it up
        total,
        valid_until
    });

    res.status(201).json({
        success: true,
        data: quotation
    });
});

exports.getQuotation = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const quotation = await Quotation.getById(id);

    if (!quotation) {
        return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    res.status(200).json({
        success: true,
        data: quotation
    });
});

exports.getAllQuotations = catchAsync(async (req, res, next) => {
    const { quotationNumber, fromDate, toDate, customerId, page, limit } = req.query;

    const result = await Quotation.getAll({
        quotationNumber,
        fromDate,
        toDate,
        customerId,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10
    });

    res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
    });
});

exports.updateQuotation = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { customer_id, user_id, items, sub_total, discount, total, valid_until, remarks } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'No items provided' });
    }

    const quotation = await Quotation.update(id, {
        customer_id: customer_id ? parseInt(customer_id) : undefined,
        user_id: user_id ? parseInt(user_id) : undefined,
        items,
        sub_total,
        discount,
        total,
        valid_until,
        remarks
    });

    res.status(200).json({
        success: true,
        data: quotation
    });
});
