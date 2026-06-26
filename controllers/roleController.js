const Role = require('../models/roleModel');
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../middleware/errorHandler");

const roleController = {
    // Fetch all roles for dropdowns (Staff, Admin, etc.)
    getRoles: catchAsync(async (req, res, next) => {
        const roles = await Role.getAll();

        res.status(200).json({
            success: true,
            data: roles
        });
    })
};

module.exports = roleController;