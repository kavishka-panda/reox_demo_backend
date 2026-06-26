const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const Supplier = require("../models/supplierModel");
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../middleware/errorHandler");

// ... (existing imports and methods)

exports.importSuppliers = catchAsync(async (req, res, next) => {
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
            fs.unlinkSync(filePath);
            return next(new AppError('File is empty!', 400));
        }

        for (const row of rows) {
            // Expected headers: Supplier Name, Email, Contact Number, Company, Bank, Account Number
            const supplierName = (row['Supplier Name'] || row['Name'] || '').toString().trim();
            const email = (row['Email'] || '').toString().trim();
            const contactNumber = (row['Contact Number'] || row['Phone'] || '').toString().trim();
            const companyName = (row['Company'] || '').toString().trim();
            const bankName = (row['Bank'] || '').toString().trim();
            const accountNumber = (row['Account Number'] || row['Account'] || '').toString().trim();

            if (!supplierName || !contactNumber || !companyName) {
                skippedCount++;
                errors.push({ name: supplierName || 'Unknown', error: 'Missing required fields (Supplier Name, Contact Number, Company)' });
                continue;
            }

            try {
                // Lookup IDs
                const companyId = await Supplier.getCompanyIdByName(companyName);
                if (!companyId) throw new Error(`Company '${companyName}' not found`);

                let bankId = null;
                if (bankName) {
                    bankId = await Supplier.getBankIdByName(bankName);
                    if (!bankId) throw new Error(`Bank '${bankName}' not found`);
                }

                // Prepare Data
                const supplierData = {
                    supplierName,
                    email,
                    contactNumber,
                    companyId,
                    bankId,
                    accountNumber
                };

                await Supplier.createSupplier(supplierData);
                successCount++;

            } catch (err) {
                skippedCount++;
                errors.push({ name: supplierName, error: err.message });
            }
        }

    } catch (error) {
        console.error("File processing error:", error);
        return next(new AppError('Error processing file', 500));
    } finally {
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

exports.addCompany = catchAsync(async (req, res, next) => {
    const { name, email, contact } = req.body;
    
    // Check if company already exists
    const companyExists = await Supplier.checkCompanyExists(name);
    if (companyExists) {
        return next(new AppError("Company with this name already exists.", 400));
    }
    
    const companyId = await Supplier.createCompany({ name, email, contact });

    res.status(201).json({
        success: true,
        message: "Company added successfully!",
        data: { id: companyId, name, email, contact }
    });
});

exports.searchCompany = catchAsync(async (req, res, next) => {
    const query = req.query.q || '';
    const companies = await Supplier.searchCompanies(query);
    res.status(200).json({ success: true, data: companies });
});

exports.getCompanies = catchAsync(async (req, res, next) => {
    const companies = await Supplier.getAllCompanies();
    res.status(200).json({ success: true, data: companies });
});

exports.updateCompany = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, email, contact } = req.body;

    const result = await Supplier.updateCompany(id, { name, email, contact });

    if (result.affectedRows === 0) {
        return next(new AppError("Company not found.", 404));
    }

    res.status(200).json({
        success: true,
        message: "Company updated successfully!"
    });
});

exports.searchBank = catchAsync(async (req, res, next) => {
    const query = req.query.q || '';
    const banks = await Supplier.searchBanks(query);
    res.status(200).json({ success: true, data: banks });
});

exports.addBank = catchAsync(async (req, res, next) => {
    const { bankName } = req.body;
    
    if (!bankName || !bankName.trim()) {
        return next(new AppError("Bank name is required.", 400));
    }

    // Check if bank already exists
    const bankId = await Supplier.getBankIdByName(bankName);
    if (bankId) {
        return next(new AppError("Bank with this name already exists.", 400));
    }
    
    const newBankId = await Supplier.createBank({ bankName });

    res.status(201).json({
        success: true,
        message: "Bank added successfully!",
        data: { id: newBankId, bankName }
    });
});

exports.addSupplier = catchAsync(async (req, res, next) => {
    const { companyId, bankId } = req.body;
    
    // Check if company exists
    const companyExists = await Supplier.checkCompanyExistsById(companyId);
    if (!companyExists) {
        return next(new AppError("Company with this ID does not exist.", 400));
    }
    
    // Check if bank exists (if bankId is provided)
    if (bankId) {
        const bankExists = await Supplier.checkBankExistsById(bankId);
        if (!bankExists) {
            return next(new AppError("Bank with this ID does not exist.", 400));
        }
    }
    
    const supplierId = await Supplier.createSupplier(req.body);

    res.status(201).json({
        success: true,
        message: "Supplier added successfully!",
        supplierId
    });
});

exports.getSuppliers = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Supplier.getAllSuppliers(page, limit);
    
    res.status(200).json({ 
        success: true, 
        data: result.data,
        pagination: result.pagination
    });
});

exports.getSupplierDropdownList = catchAsync(async (req, res, next) => {
    const suppliers = await Supplier.getSupplierDropdownList();
    res.status(200).json({ success: true, data: suppliers });
});

exports.updateSupplier = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { supplierName, contactNumber, companyId, bankId, accountNumber, email } = req.body;
    
    if (!supplierName || !contactNumber || !companyId) {
        return next(new AppError("Supplier name, contact number and company are required.", 400));
    }

    const result = await Supplier.updateSupplier(id, {
        supplierName,
        contactNumber,
        email,
        companyId,
        bankId,
        accountNumber
    });

    if (result.affectedRows === 0) {
        return next(new AppError("Supplier not found.", 404));
    }

    res.status(200).json({
        success: true,
        message: "Supplier updated successfully!"
    });
});

exports.updateSupplierContact = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    let { contactNumber } = req.body;

    if (!contactNumber) {
        return next(new AppError("Contact number is required.", 400));
    }

    // Clean the contact number (remove non-digits) to fit in 10 chars if possible
    contactNumber = contactNumber.replace(/\D/g, '');

    if (contactNumber.length > 10) {
        return next(new AppError("Contact number exceeds the maximum length of 10 digits.", 400));
    }

    const result = await Supplier.updateContact(id, contactNumber);

    if (result.affectedRows === 0) {
        return next(new AppError("Supplier not found.", 404));
    }

    res.status(200).json({
        success: true,
        message: "Contact number updated successfully!"
    });
});

exports.updateSupplierStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { currentStatusId } = req.body;

    if (!currentStatusId || (currentStatusId !== 1 && currentStatusId !== 2)) {
        return next(new AppError("Current status ID must be either 1 (Active) or 2 (Inactive).", 400));
    }

    const result = await Supplier.updateStatus(id, currentStatusId);

    if (result.affectedRows === 0) {
        return next(new AppError("Supplier not found.", 404));
    }

    const newStatus = currentStatusId === 1 ? 'Inactive' : 'Active';
    res.status(200).json({
        success: true,
        message: `Supplier status updated to ${newStatus} successfully!`
    });
});