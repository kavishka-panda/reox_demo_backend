// middleware/userValidator.js
const { AppError } = require("./errorHandler");

const validateUser = (req, res, next) => {
    const { name, email, contact, password, confirmPassword, role } = req.body;

    // 1. Check if any required fields are empty (email is now optional)
    if (!name || !contact || !password || !confirmPassword || !role) {
        return next(new AppError("Name, contact, password, and role are required.", 400));
    }

    // 2. Password match validation
    if (password !== confirmPassword) {
        return next(new AppError("Passwords do not match. Please try again.", 400));
    }

    // 3. Email format validation (Only if provided)
    if (email && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return next(new AppError("Invalid email format.", 400));
        }
    }

    next();
};

module.exports = { validateUser };