const validateCustomer = (req, res, next) => {
    const { name, contact, status_id } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).json({ success: false, message: "Customer name is required" });
    }

    const contactRegex = /^\d{10}$/;
    if (!contact || !contactRegex.test(contact)) {
        return res.status(400).json({ success: false, message: "A valid 10-digit phone number is required." });
    }

    next();
};

const validateCustomerNumber = (req, res, next) => {
    const { phone } = req.body;
    const phoneRegex = /^\d{10}$/;
    if (!phone || !phoneRegex.test(phone)) {
        return res.status(400).json({ success: false, message: "A valid 10-digit phone number is required." });
    }
    next();
};

module.exports = {
    validateCustomer,
    validateCustomerNumber
};