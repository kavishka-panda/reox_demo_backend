const Unit = require('../models/unitModel');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Search units by name
 */
exports.searchUnits = catchAsync(async (req, res, next) => {
    const query = req.query.q || '';
    const units = await Unit.searchUnits(query);
    
    res.status(200).json({ success: true, data: units });
});

/**
 * @desc    Add a new unit
 */
exports.addUnit = catchAsync(async (req, res, next) => {
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Unit name is required", 400));
    }

    // Check for duplicates
    const exists = await Unit.checkNameExists(name);
    if (exists) {
        return next(new AppError("This unit already exists!", 400));
    }

    const unitId = await Unit.createUnit(name.trim());

    res.status(201).json({
        success: true,
        message: "Unit added successfully!",
        data: { id: unitId, name: name }
    });
});

/**
 * @desc    Get all units list
 */
exports.getUnits = catchAsync(async (req, res, next) => {
    const units = await Unit.getAllUnits();
    
    res.status(200).json({
        success: true,
        data: units
    });
});

/**
 * @desc    Update unit name
 */
exports.updateUnit = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Unit name is required", 400));
    }

    // Check if name is taken by another unit
    const exists = await Unit.checkNameExists(name, id);
    if (exists) {
        return next(new AppError("This unit name already exists!", 400));
    }

    const result = await Unit.updateUnit(id, name.trim());

    if (result.affectedRows === 0) {
        return next(new AppError("Unit not found", 404));
    }

    res.status(200).json({
        success: true,
        message: "Unit updated successfully",
        data: { id, name }
    });
});

/**
 * @desc    Delete a unit if not in use
 */
exports.deleteUnit = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Business Logic: Check if unit is used in products
    const inUse = await Unit.isUnitUsed(id);
    if (inUse) {
        return next(new AppError("This unit is already assigned to products and cannot be deleted.", 400));
    }

    await Unit.deleteUnit(id);

    res.status(200).json({
        success: true,
        message: "Unit deleted successfully!"
    });
});