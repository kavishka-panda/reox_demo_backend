const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');
const Unit = require('../models/unitModel');
const ProductType = require('../models/productTypeModel');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Import products from Excel/CSV file
 * @route   POST /api/products/import
 */
exports.importProducts = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload a file!', 400));
    }

    const filePath = req.file.path;
    let successCount = 0;
    let skippedCount = 0;
    let errors = [];

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) {
            fs.unlinkSync(filePath); // Delete file
            return next(new AppError('File is empty!', 400));
        }

        for (const row of rows) {
            // Map keys (normalize to lowercase/trim to match expectations)
            // Expected headers: Name, Code, Barcode, Category, Brand, Unit, Type, Color, Size, Storage
            const productName = (row['Name'] || row['Product Name'] || '').toString().trim();
            const productCode = (row['Code'] || row['Product Code'] || '').toString().trim();
            const barcode = (row['Barcode'] || '').toString().trim();
            const categoryName = (row['Category'] || '').toString().trim();
            const brandName = (row['Brand'] || '').toString().trim();
            const unitName = (row['Unit'] || '').toString().trim();
            const typeName = (row['Type'] || row['Product Type'] || '').toString().trim();
            
            // Optional Variation fields
            const color = (row['Color'] || 'Default').toString().trim();
            const size = (row['Size'] || 'Default').toString().trim();
            const storage = (row['Storage'] || row['Capacity'] || 'N/A').toString().trim();

            if (!productName || !productCode || !categoryName || !brandName || !unitName || !typeName) {
                skippedCount++;
                errors.push({ name: productName || 'Unknown', error: 'Missing required fields (Name, Code, Category, Brand, Unit, Type)' });
                continue;
            }

            try {
                // Lookup IDs
                const categoryId = await Category.getIdByName(categoryName);
                if (!categoryId) throw new Error(`Category '${categoryName}' not found`);

                const brandId = await Brand.getIdByName(brandName);
                if (!brandId) throw new Error(`Brand '${brandName}' not found`);

                const unitId = await Unit.getIdByName(unitName);
                if (!unitId) throw new Error(`Unit '${unitName}' not found`);

                const typeId = await ProductType.getIdByName(typeName);
                if (!typeId) throw new Error(`Product Type '${typeName}' not found`);

                // Check for duplicate product code or barcode
                const codeExists = await Product.checkIdExists('product', 'product_code', productCode);
                if (codeExists) throw new Error(`Product Code '${productCode}' already exists`);

                if (barcode) {
                     const barcodeExists = await Product.checkIdExists('product_variations', 'barcode', barcode);
                     if (barcodeExists) throw new Error(`Barcode '${barcode}' already exists`);
                }

                // Prepare Data
                const productData = {
                    name: productName,
                    code: productCode,
                    categoryId,
                    brandId,
                    unitId,
                    typeId
                };

                const variations = [{
                    barcode: barcode || Math.floor(Math.random() * 100000000000).toString(), // Generate simplified random barcode if missing
                    color: color,
                    size: size,
                    capacity: storage,
                    statusId: 1
                }];

                await Product.create(productData, variations);
                successCount++;

            } catch (err) {
                skippedCount++;
                errors.push({ name: productName, error: err.message });
            }
        }

    } catch (error) {
        console.error("File processing error:", error);
        return next(new AppError('Error processing file', 500));
    } finally {
        // Cleanup file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    res.status(200).json({
        success: true,
        message: `Import processed. Success: ${successCount}, Skipped: ${skippedCount}`,
        data: { successCount, skippedCount, errors }
    });
});

/**
 * @desc    Add a new product with its variations
 * @route   POST /api/products/add
 */
exports.addProduct = catchAsync(async (req, res, next) => {
    const { productData, variations } = req.body;

    // Check if product code already exists
    const codeExists = await Product.checkIdExists('product', 'product_code', productData.code);
    if (codeExists) {
        return next(new AppError('Product Code already exists!', 400));
    }

    let finalVariations = [];
    // If no variations are provided, create a default variation
    if (!variations || variations.length === 0) {
        // Check if barcode exists
        if (productData.barcode) {
            const barcodeExists = await Product.checkIdExists('product_variations', 'barcode', productData.barcode);
            if (barcodeExists) {
                return next(new AppError('Barcode already exists!', 400));
            }
        }

        finalVariations.push({
            barcode: productData.barcode,
            color: 'Default', 
            size: 'Default', 
            capacity: 'N/A', 
            statusId: 1
        });
    } else {
        // Check all barcodes in variations
        for (const variant of variations) {
            if (variant.barcode) {
                const barcodeExists = await Product.checkIdExists('product_variations', 'barcode', variant.barcode);
                if (barcodeExists) {
                    return next(new AppError(`Barcode '${variant.barcode}' already exists!`, 400));
                }
            }
        }
        finalVariations = variations;
    }

    await Product.create(productData, finalVariations);
    
    res.status(201).json({ 
        success: true, 
        message: "Product saved successfully!" 
    });
});

/**
 * @desc    Get all active products (Status 1)
 * @route   GET /api/products
 */
exports.getProducts = catchAsync(async (req, res, next) => {
    const products = await Product.getProductsByStatus(1);
    
    res.status(200).json({
        success: true,
        data: products
    });
});

/**
 * @desc    Get all active product variations
 * @route   GET /api/products/variations
 */
exports.getAllVariations = catchAsync(async (req, res, next) => {
    const variations = await Product.getAllVariations(1);
    
    res.status(200).json({
        success: true,
        data: variations
    });
});

/**
 * @desc    Get active products list for selection dropdowns
 * @route   GET /api/products/dropdown
 */
exports.getProductsForDropdown = catchAsync(async (req, res, next) => {
    const { searchTerm, limit } = req.query;
    console.log(`Dropdown Request - Search: '${searchTerm}', Limit: '${limit}'`);
    const products = await Product.getProductsForDropdown(1, searchTerm, limit || 10);
    
    res.status(200).json({
        success: true,
        data: products
    });
});

/**
 * @desc    Get all variations for a specific product ID
 * @route   GET /api/products/variants/:productId
 */
exports.getProductVariants = catchAsync(async (req, res, next) => {
    const { productId } = req.params;
    
    // Check if product exists
    const productExists = await Product.checkIdExists('product', 'id', productId);
    if (!productExists) {
        return next(new AppError("Product not found", 404));
    }

    const { statusId } = req.query;
    const variants = await Product.getProductVariantsByProductId(productId, statusId || 1);
    
    res.status(200).json({
        success: true,
        data: variants
    });
});

/**
 * @desc    Update a specific product variation and its parent product
 * @route   PUT /api/products/update/:pvId
 */
exports.updateProduct = catchAsync(async (req, res, next) => {
    const { pvId } = req.params;
    const { productData, variationData } = req.body;

    const parsedPvId = parseInt(pvId);
    const variation = await Product.getVariationById(parsedPvId);
    if (!variation) {
        return next(new AppError("Product variation not found", 404));
    }

    const productId = variation.product_id;

    // Check if new product code already exists on a DIFFERENT product
    if (productData.code) {
        const productWithCode = await Product.getProductByCode(productData.code);
        if (productWithCode && productWithCode.id !== productId) {
            return next(new AppError('Product Code already exists on another product!', 400));
        }
    }

    // Generate unique barcode if not provided or check uniqueness if changed
    if (variationData) {
        if (!variationData.barcode) {
            let isUnique = false;
            let newBarcode = "";
            while (!isUnique) {
                newBarcode = Math.floor(Math.random() * 1000000000000).toString().padStart(13, '0');
                const exists = await Product.checkIdExists('product_variations', 'barcode', newBarcode);
                if (!exists) {
                    isUnique = true;
                }
            }
            variationData.barcode = newBarcode;
        } else if (variationData.barcode !== variation.barcode) {
            const barcodeExists = await Product.checkIdExists('product_variations', 'barcode', variationData.barcode);
            if (barcodeExists) {
                return next(new AppError('Barcode already exists on another product!', 400));
            }
        }
    }

    await Product.updateProductVariation(pvId, productData, variationData);
    
    res.status(200).json({ 
        success: true, 
        message: "Product updated successfully!" 
    });
});

/**
 * @desc    Search active products by type or search term
 * @route   GET /api/products/search
 */
exports.searchProducts = catchAsync(async (req, res, next) => {
    const { productTypeId, searchTerm, unitId } = req.query;
    console.log(`Searching Active Products - Type: ${productTypeId}, Unit: ${unitId}, Term: ${searchTerm}`);
    const products = await Product.searchProducts({ productTypeId, searchTerm, unitId }, 1);

    res.status(200).json({ 
        success: true, 
        data: products 
    });
});

/**
 * @desc    Search inactive products by type or search term
 * @route   GET /api/products/search-deactive
 */
exports.searchDeactiveProducts = catchAsync(async (req, res, next) => {
    const { productTypeId, searchTerm, unitId } = req.query;
    const products = await Product.searchProducts({ productTypeId, searchTerm, unitId }, 2);

    res.status(200).json({ 
        success: true, 
        data: products 
    });
});

/**
 * @desc    Activate or Deactivate a product variation
 * @route   PATCH /api/products/status/:pvId
 */
exports.changeProductStatus = catchAsync(async (req, res, next) => {
    const { pvId } = req.params;
    const { statusId } = req.body; // 1 = Active, 2 = Inactive

    // Check if product variation exists
    const productExists = await Product.checkIdExists('product_variations', 'id', pvId);
    if (!productExists) {
        return next(new AppError("Product variation not found", 404));
    }

    const result = await Product.updateProductStatus(pvId, statusId);
    
    if (result.affectedRows === 0) {
        return next(new AppError("Product variation not found", 404));
    }
    
    res.status(200).json({
        success: true,
        message: statusId == 1 ? "Product activated!" : "Product deactivated!"
    });
});

/**
 * @desc    Get all inactive products (Status 2)
 * @route   GET /api/products/deactive
 */
exports.getDeactiveProducts = catchAsync(async (req, res, next) => {
    const products = await Product.getProductsByStatus(3);
    
    res.status(200).json({
        success: true,
        data: products
    });
});

/**
 * @desc    Permanently delete a product variation
 * @route   DELETE /api/products/:pvId
 */
exports.deleteProduct = catchAsync(async (req, res, next) => {
    const { pvId } = req.params;

    // Check if product variation exists
    const productExists = await Product.checkIdExists('product_variations', 'id', pvId);
    if (!productExists) {
        return next(new AppError("Product variation not found", 404));
    }

    const result = await Product.deleteProductVariation(pvId);
    
    if (result.affectedRows === 0) {
        return next(new AppError("Product variation not found", 404));
    }
    
    res.status(200).json({
        success: true,
        message: "Product permanently deleted!"
    });
});

/**
 * @desc    Add a new variation to an existing product
 * @route   POST /api/products/:productId/variants
 */
exports.addProductVariation = catchAsync(async (req, res, next) => {
    const { productId } = req.params;
    const variationData = req.body;

    // Check if product exists
    const productExists = await Product.checkIdExists('product', 'id', productId);
    if (!productExists) {
        return next(new AppError("Product not found", 404));
    }

    // Generate unique barcode if not provided
    if (!variationData.barcode) {
        let isUnique = false;
        let newBarcode = "";
        while (!isUnique) {
            newBarcode = Math.floor(Math.random() * 1000000000000).toString().padStart(13, '0');
            const exists = await Product.checkIdExists('product_variations', 'barcode', newBarcode);
            if (!exists) {
                isUnique = true;
            }
        }
        variationData.barcode = newBarcode;
    }

    // Check if provided barcode already exists (only if it was provided by user)
    else {
        const barcodeExists = await Product.checkIdExists('product_variations', 'barcode', variationData.barcode);
        if (barcodeExists) {
            return next(new AppError("Barcode already exists!", 400));
        }
    }

    const variation = await Product.addVariation(productId, variationData);

    res.status(201).json({
        success: true,
        message: "Variation added successfully!",
        data: variation
    });
});

/**
 * @desc    Check if a product code exists
 * @route   GET /api/products/check-code/:code
 */
exports.checkProductCode = catchAsync(async (req, res, next) => {
    const { code } = req.params;
    const exists = await Product.checkIdExists('product', 'product_code', code);
    
    res.status(200).json({
        success: true,
        exists
    });
});