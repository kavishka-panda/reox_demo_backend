const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { validateProduct, validateUpdateMiddleware} = require('../middleware/productValidator');
const upload = require('../middleware/fileUpload');

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         productID:
 *           type: integer
 *           description: Product ID
 *         productName:
 *           type: string
 *           description: Product name
 *         productCode:
 *           type: string
 *           description: Product code
 *         barcode:
 *           type: string
 *           description: Product barcode
 *         category:
 *           type: string
 *           description: Category name
 *         brand:
 *           type: string
 *           description: Brand name
 *         unit:
 *           type: string
 *           description: Unit name
 *         productType:
 *           type: string
 *           description: Product type
 *         color:
 *           type: string
 *           description: Product color
 *         size:
 *           type: string
 *           description: Product size
 *         storage:
 *           type: string
 *           description: Storage capacity
 *         createdOn:
 *           type: string
 *           format: date
 *           description: Creation date
 *     ProductData:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - categoryId
 *         - brandId
 *         - unitId
 *         - typeId
 *       properties:
 *         name:
 *           type: string
 *           description: Product name
 *         code:
 *           type: string
 *           description: Product code
 *         barcode:
 *           type: string
 *           description: Product barcode
 *         categoryId:
 *           type: integer
 *           description: Category ID
 *         brandId:
 *           type: integer
 *           description: Brand ID
 *         unitId:
 *           type: integer
 *           description: Unit ID
 *         typeId:
 *           type: integer
 *           description: Product type ID
 *     ProductVariation:
 *       type: object
 *       properties:
 *         barcode:
 *           type: string
 *           description: Variation barcode
 *         color:
 *           type: string
 *           description: Product color
 *         size:
 *           type: string
 *           description: Product size
 *         capacity:
 *           type: string
 *           description: Storage capacity
 *         statusId:
 *           type: integer
 *           description: Status ID (1=Active, 2=Inactive)
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Product'
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         error:
 *           type: string
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 */

/**
 * @swagger
 * /api/products/create:
 *   post:
 *     summary: Create a new product with variations
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productData
 *             properties:
 *               productData:
 *                 $ref: '#/components/schemas/ProductData'
 *               variations:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProductVariation'
 *                 description: Product variations (optional)
 *           examples:
 *             basic:
 *               summary: Basic product without variations
 *               value:
 *                 productData:
 *                   name: "iPhone 14"
 *                   code: "IP14"
 *                   barcode: "1234567890123"
 *                   categoryId: 1
 *                   brandId: 2
 *                   unitId: 1
 *                   typeId: 1
 *             withVariations:
 *               summary: Product with variations
 *               value:
 *                 productData:
 *                   name: "iPhone 14"
 *                   code: "IP14"
 *                   barcode: "1234567890123"
 *                   categoryId: 1
 *                   brandId: 2
 *                   unitId: 1
 *                   typeId: 1
 *                 variations:
 *                   - barcode: "1234567890124"
 *                     color: "Blue"
 *                     size: "128GB"
 *                     capacity: "128"
 *                     statusId: 1
 *                   - barcode: "1234567890125"
 *                     color: "Red"
 *                     size: "256GB"
 *                     capacity: "256"
 *                     statusId: 1
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product saved successfully!"
 *       400:
 *         description: Duplicate barcode or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Barcode or Product Code already exists!"
 *               errors:
 *                 - field: "code/barcode"
 *                   message: "Already exists!"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Successfully retrieved all products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 - productID: 1
 *                   productName: "iPhone 14"
 *                   productCode: "IP14"
 *                   barcode: "1234567890123"
 *                   category: "Electronics"
 *                   brand: "Apple"
 *                   unit: "Piece"
 *                   productType: "Mobile"
 *                   color: "Blue"
 *                   size: "128GB"
 *                   storage: "128"
 *                   createdOn: "2024-01-01"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/products/update/{pvId}:
 *   put:
 *     summary: Update a product variation
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: pvId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product variation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productData
 *               - variationData
 *             properties:
 *               productData:
 *                 $ref: '#/components/schemas/ProductData'
 *               variationData:
 *                 $ref: '#/components/schemas/ProductVariation'
 *           example:
 *             productData:
 *               name: "iPhone 14 Pro"
 *               code: "IP14P"
 *               barcode: "1234567890123"
 *               categoryId: 1
 *               brandId: 2
 *               unitId: 1
 *               typeId: 1
 *             variationData:
 *               barcode: "1234567890124"
 *               color: "Space Gray"
 *               size: "256GB"
 *               capacity: "256"
 *               statusId: 1
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product updated successfully!"
 *       400:
 *         description: Duplicate barcode or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/products/status/{pvId}:
 *   patch:
 *     summary: Activate or deactivate a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: pvId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product variation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - statusId
 *             properties:
 *               statusId:
 *                 type: integer
 *                 enum: [1, 2]
 *                 description: Status ID (1=Active, 2=Inactive)
 *           example:
 *             statusId: 2
 *     responses:
 *       200:
 *         description: Product status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product deactivated!"
 *       404:
 *         description: Product variation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Product variation not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Search products by product type and/or search term
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: productTypeId
 *         schema:
 *           type: integer
 *         description: Filter by product type ID
 *         example: 1
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *         description: Search term to filter products by name, code, or barcode
 *         example: "iPhone"
 *     responses:
 *       200:
 *         description: Successfully retrieved filtered products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 - productID: 1
 *                   productName: "iPhone 14"
 *                   productCode: "IP14"
 *                   barcode: "1234567890123"
 *                   category: "Electronics"
 *                   brand: "Apple"
 *                   unit: "Piece"
 *                   productType: "Mobile"
 *                   color: "Blue"
 *                   size: "128GB"
 *                   storage: "128"
 *                   createdOn: "2024-01-01"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
 
router.post('/import', upload.single('file'), productController.importProducts);
router.post('/create', validateProduct, productController.addProduct);
router.get('/', productController.getProducts);
router.get('/variations', productController.getAllVariations);
router.get('/dropdown', productController.getProductsForDropdown);
router.get('/:productId/variants', productController.getProductVariants);
router.post('/:productId/variants', productController.addProductVariation);
router.get('/deactive', productController.getDeactiveProducts);

router.put('/update/:pvId', validateUpdateMiddleware, productController.updateProduct);
router.patch('/status/:pvId', productController.changeProductStatus);

router.get('/search' , productController.searchProducts);
router.get('/search/deactive' , productController.searchDeactiveProducts);
router.get('/check-code/:code', productController.checkProductCode);

router.delete('/:pvId', productController.deleteProduct);

module.exports = router;