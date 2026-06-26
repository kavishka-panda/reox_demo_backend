const { body, validationResult } = require('express-validator');
const Product = require('../models/productModel');

const validateUpdateMiddleware = [
    // 1. Basic Field Validation
    body('productData.name').notEmpty().withMessage('Product name is required'),
    body('productData.code').notEmpty().withMessage('Product code is required'),
    body('variationData.barcode').notEmpty().withMessage('Barcode is required'),

    // 2. Custom Database Validation (Foreign Keys)
    body('productData.categoryId').custom(async (value) => {
        const exists = await Product.checkIdExists('category', 'idcategory', value);
        if (!exists) throw new Error('Invalid Category ID');
        return true;
    }),
    body('productData.brandId').custom(async (value) => {
        const exists = await Product.checkIdExists('brand', 'idbrand', value);
        if (!exists) throw new Error('Invalid Brand ID');
        return true;
    }),
    body('productData.unitId').custom(async (value) => {
        const exists = await Product.checkIdExists('unit_id', 'idunit_id', value);
        if (!exists) throw new Error('Invalid Unit ID');
        return true;
    }),
    body('productData.typeId').custom(async (value) => {
        const exists = await Product.checkIdExists('product_type', 'idproduct_type', value);
        if (!exists) throw new Error('Invalid Product Type ID');
        return true;
    }),

    // 3. Response handling
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorArray = errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }));

            return res.status(400).json({
                success: false,
                message: errorArray[0].message,
                errors: errorArray
            });
        }
        next();
    }
];

const validateProduct = [
    body('productData.name').notEmpty().withMessage('Product name is required'),
    body('productData.code').notEmpty().withMessage('Product code is required'),
    
    body('productData.categoryId').notEmpty().withMessage('Category ID is required').custom(async (value) => {
        const exists = await Product.checkIdExists('category', 'idcategory', value);
        if (!exists) throw new Error('Invalid Category ID');
        return true;
    }),
    body('productData.brandId').notEmpty().withMessage('Brand ID is required').custom(async (value) => {
        const exists = await Product.checkIdExists('brand', 'idbrand', value);
        if (!exists) throw new Error('Invalid Brand ID');
        return true;
    }),
    body('productData.unitId').notEmpty().withMessage('Unit ID is required').custom(async (value) => {
        const exists = await Product.checkIdExists('unit_id', 'idunit_id', value);
        if (!exists) throw new Error('Invalid Unit ID');
        return true;
    }),
    body('productData.typeId').notEmpty().withMessage('Product Type ID is required').custom(async (value) => {
        const exists = await Product.checkIdExists('product_type', 'idproduct_type', value);
        if (!exists) throw new Error('Invalid Product Type ID');
        return true;
    }),

    body('productData.barcode').if((value, { req }) => !req.body.variations || req.body.variations.length === 0)
        .notEmpty().withMessage('Barcode is required for simple products'),

    body('variations.*.barcode').notEmpty().withMessage('Variant barcode is required'),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorArray = errors.array();
            return res.status(400).json({ 
                success: false, 
                message: errorArray[0].msg,
                errors: errorArray.map(err => ({ field: err.path, message: err.msg })) 
            });
        }
        next();
    }
];

module.exports = { validateUpdateMiddleware, validateProduct };