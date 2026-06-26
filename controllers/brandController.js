const Brand = require('../models/BrandModel');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Search brands by name
 */
exports.searchBrands = catchAsync(async (req, res, next) => {
    const query = req.query.q || '';
    const brands = await Brand.searchBrands(query);
    
    res.status(200).json({ success: true, data: brands });
});

/**
 * @desc    Add a new brand
 */
exports.addBrand = catchAsync(async (req, res, next) => {
    const { name } = req.body;

    // 1) Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Brand name is required", 400));
    }

    // 2) Check for duplicate name
    const exists = await Brand.checkNameExists(name);
    if (exists) {
        return next(new AppError("This brand already exists!", 400));
    }

    // 3) Create brand
    const brandId = await Brand.createBrand(name.trim());

    res.status(201).json({
        success: true,
        message: "Brand added successfully!",
        data: { id: brandId, name: name }
    });
});

/**
 * @desc    Get all brands
 */
exports.getBrands = catchAsync(async (req, res, next) => {
    const brands = await Brand.getAllBrand();
    
    res.status(200).json({
        success: true,
        data: brands
    });
});

/**
 * @desc    Update brand name
 */
exports.updateBrand = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;

    // 1) Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Brand name is required", 400));
    }

    // 2) Check if new name exists elsewhere
    const exists = await Brand.checkNameExists(name, id);
    if (exists) {
        return next(new AppError("This brand name already exists!", 400));
    }

    const result = await Brand.updateBrand(id, name.trim());

    if (result.affectedRows === 0) {
        return next(new AppError("Brand not found", 404));
    }

    res.status(200).json({
        success: true,
        message: "Brand updated successfully",
        data: { id, name }
    });
});

/**
 * @desc    Delete a brand
 */
exports.deleteBrand = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // 1) Business Rule: Check if brand is in use
    const inUse = await Brand.isBrandUsed(id);
    if (inUse) {
        return next(new AppError("This brand is already assigned to products and cannot be deleted.", 400));
    }

    await Brand.deleteBrand(id);

    res.status(200).json({
        success: true,
        message: "Brand deleted successfully!"
    });
});