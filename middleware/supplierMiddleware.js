const { AppError } = require('./errorHandler');

/**
 * Validates Company registration data
 */
exports.validateCompany = (req, res, next) => {
    const { name, email, contact } = req.body;

    if (!name || name.trim() === "") return next(new AppError("Company name is required", 400));
    if (!contact || contact.trim() === "") return next(new AppError("Company contact is required", 400));

    // Sri Lankan mobile number validation for contact
    const sriLankanMobileRegex = /^(\+94|0)?7[0-9]{8}$/;
    if (!sriLankanMobileRegex.test(contact.replace(/\s/g, ''))) {
        return next(new AppError("Invalid contact number format. Please use a valid Sri Lankan mobile number.", 400));
    }

    // Email format check - only if provided
    if (email && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return next(new AppError("Invalid email format", 400));
    }

    // Ensure contact is not too long for DB
    if (contact.length > 45) {
        return next(new AppError("Contact number is too long.", 400));
    }

    next();
};

/**
 * Validates Supplier registration data
 */
exports.validateSupplier = (req, res, next) => {
    const { supplierName, contactNumber, companyId, accountNumber, email } = req.body;

    if (!supplierName || !contactNumber || !companyId) {
        return next(new AppError("Supplier name, contact, and company are required.", 400));
    }

    // Sri Lankan mobile number validation
    const sriLankanMobileRegex = /^(\+94|0)?7[0-9]{8}$/;
    if (!sriLankanMobileRegex.test(contactNumber.replace(/\s/g, ''))) {
        return next(new AppError("Invalid Sri Lankan mobile number format.", 400));
    }

    // Email format check if provided
    if (email && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return next(new AppError("Invalid email format", 400));
        }
    }

    // Validate account number format if provided
    if (accountNumber && accountNumber.trim() !== "") {
        const numberRegex = /^\d+$/;
        if (!numberRegex.test(accountNumber.trim())) {
            return next(new AppError("Account number must contain only numbers.", 400));
        }
    }

    next();
};