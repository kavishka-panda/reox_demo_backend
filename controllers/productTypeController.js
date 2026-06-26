const ProductType = require('../models/productTypeModel');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Search product types by name
 */
exports.searchProductTypes = catchAsync(async (req, res, next) => {
    const query = req.query.q || '';
    const productTypes = await ProductType.searchProductTypes(query);
    
    res.status(200).json({ success: true, data: productTypes });
});

/**
 * @desc    Add a new product type
 */
exports.addProductType = catchAsync(async (req, res, next) => {
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Product type name is required", 400));
    }

    // Check for duplicates
    const exists = await ProductType.checkNameExists(name);
    if (exists) {
        return next(new AppError("This product type already exists!", 400));
    }

    const productTypeId = await ProductType.createProductType(name.trim());

    res.status(201).json({
        success: true,
        message: "Product type added successfully!",
        data: { id: productTypeId, name: name }
    });
});

/**
 * @desc    Get all product types list
 */
exports.getProductTypes = catchAsync(async (req, res, next) => {
    const productTypes = await ProductType.getAllProductTypes();
    
    res.status(200).json({
        success: true,
        data: productTypes
    });
});

/**
 * @desc    Update product type name
 */
exports.updateProductType = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Product type name is required", 400));
    }

    // Check if name is taken by another record
    const exists = await ProductType.checkNameExists(name, id);
    if (exists) {
        return next(new AppError("This product type already exists!", 400));
    }

    const result = await ProductType.updateProductType(id, name.trim());

    if (result.affectedRows === 0) {
        return next(new AppError("Product type not found", 404));
    }

    res.status(200).json({
        success: true,
        message: "Product type updated successfully",
        data: { id, name }
    });
});

/**
 * @desc    Delete a product type
 */
exports.deleteProductType = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Business Logic: Check if it's assigned to any product
    const inUse = await ProductType.isProductTypeUsed(id);
    if (inUse) {
        return next(new AppError("This product type is already assigned to products and cannot be deleted.", 400));
    }

    await ProductType.deleteProductType(id);

    res.status(200).json({
        success: true,
        message: "Product type deleted successfully!"
    });
});