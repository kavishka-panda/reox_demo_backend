const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { validateCompany, validateSupplier } = require('../middleware/supplierMiddleware');
const upload = require('../middleware/fileUpload');

router.post('/companies', validateCompany, supplierController.addCompany);
router.get('/companies/search', supplierController.searchCompany);
router.get('/companies', supplierController.getCompanies);
router.put('/companies/:id', validateCompany, supplierController.updateCompany);
router.get('/banks', supplierController.searchBank);
router.post('/banks', supplierController.addBank);

router.post('/import', upload.single('file'), supplierController.importSuppliers);
router.post('/add', validateSupplier, supplierController.addSupplier);
router.get('/list', supplierController.getSuppliers);
router.get('/dropdown-list', supplierController.getSupplierDropdownList);
router.put('/update/:id', supplierController.updateSupplier);
router.patch('/update-contact/:id', supplierController.updateSupplierContact);
router.patch('/update-status/:id', supplierController.updateSupplierStatus);

module.exports = router;