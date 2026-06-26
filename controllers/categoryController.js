const Category = require('../models/categoryModel');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Search categories by name
 */
exports.searchCategories = catchAsync(async (req, res, next) => {
    const query = req.query.q || '';
    const categories = await Category.searchCategories(query);
    
    res.status(200).json({ success: true, data: categories });
});

/**
 * @desc    Add a new category
 */
exports.addCategory = catchAsync(async (req, res, next) => {
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Category name is required", 400));
    }

    // Check for duplicate name
    const exists = await Category.checkNameExists(name);
    if (exists) {
        return next(new AppError("This category already exists!", 400));
    }

    const categoryId = await Category.createCategory(name.trim());

    res.status(201).json({
        success: true,
        message: "Category added successfully!",
        data: { id: categoryId, name: name }
    });
});

/**
 * @desc    Get all categories
 */
exports.getCategories = catchAsync(async (req, res, next) => {
    const categories = await Category.getAllCategory();
    
    res.status(200).json({
        success: true,
        data: categories
    });
});

/**
 * @desc    Update category name
 */
exports.updateCategory = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return next(new AppError("Category name is required", 400));
    }

    // Check if name is already taken by another category
    const exists = await Category.checkNameExists(name, id);
    if (exists) {
        return next(new AppError("This category name already exists!", 400));
    }

    const result = await Category.updateCategory(id, name.trim());

    if (result.affectedRows === 0) {
        return next(new AppError("Category not found", 404));
    }

    res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: { id, name }
    });
});

/**
 * @desc    Delete a category
 */
exports.deleteCategory = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Business Logic check
    const inUse = await Category.isCategoryUsed(id);
    if (inUse) {
        return next(new AppError("This category is already assigned to products and cannot be deleted.", 400));
    }

    await Category.deleteCategory(id);

    res.status(200).json({
        success: true,
        message: "Category deleted successfully!"
    });
});