const PaymentType = require("../models/paymentTypeModel");
const db = require("../config/db");
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../middleware/errorHandler");

exports.getPaymentTypes = catchAsync(async (req, res, next) => {

    const paymentType = await PaymentType.getPaymentType();
    
    if (!paymentType.length) {
        return next(new AppError('No payment types found', 404));
    }
    
    res.status(200).json({
        success: true,
        data: paymentType
    });
});