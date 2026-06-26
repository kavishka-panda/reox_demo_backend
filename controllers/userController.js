
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../middleware/errorHandler");
const prisma = require('../config/prismaClient'); 

const userController = {
    addUser: catchAsync(async (req, res, next) => {
        const { name, email, contact, password, role } = req.body;

        // 0. Validate required fields
        if (!name || !password || !role) {
            return next(new AppError("Name, password, and role are required.", 400));
        }

        // At least email or contact must be provided
        const hasEmail = email && typeof email === 'string' && email.trim() !== '';
        const hasContact = contact && typeof contact === 'string' && contact.trim() !== '';
        
        if (!hasEmail && !hasContact) {
            return next(new AppError("Either email or contact number must be provided.", 400));
        }

        // 1. Check if Email or Contact already exists in the DB
        // Build the OR conditions only for non-empty values to avoid matching null/empty fields
        const orConditions = [];
        
        if (email && typeof email === 'string' && email.trim() !== '') {
            orConditions.push({ email: email.trim() });
        }
        
        if (contact && typeof contact === 'string' && contact.trim() !== '') {
            orConditions.push({ contact: contact.trim() });
        }

        // Only check for duplicates if we have at least one condition
        if (orConditions.length > 0) {
            const existing = await prisma.user.findFirst({
                where: {
                    OR: orConditions
                }
            });

            if (existing) {
                return next(new AppError("Email or Contact number already exists in the system.", 400));
            }
        }

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Save to Database using Model
        const userId = await User.create({
            name,
            contact,
            email,
            password: hashedPassword,
            role
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully.",
            data: { userId, name, email, role }
        });
    }),

    // Get all users list
    getAllUsers: catchAsync(async (req, res, next) => {
        const users = await User.getAllUsers();

        res.status(200).json({
            success: true,
            results: users.length,
            data: users
        });
    }),

    // Toggle User Status (Active/Deactive
    toggleUserStatus: catchAsync(async (req, res, next) => {
        const { userId } = req.params;
        const { isActive } = req.body;

        const statusId = isActive ? 1 : 2;

        const result = await User.updateStatus(userId, statusId);

        if (result.affectedRows === 0) {
            return next(new AppError("User not found.", 404));
        }

        res.status(200).json({
            success: true,
            message: `User has been ${isActive ? 'Activated' : 'Deactivated'} successfully.`,
            data: { userId, statusId }
        });
    }),


    updateUser: catchAsync(async (req, res, next) => {
        const { userId } = req.params;
        const { contact, role_id, password, confirmPassword } = req.body;

        // 1. Basic Validation
        if (!contact || !role_id) {
            return next(new AppError("Contact number and User Role are required.", 400));
        }

        // 2. ⚡ New: Check if the contact number is already taken by ANOTHER user
        const isContactTaken = await User.checkContactExcludingSelf(contact, userId);
        if (isContactTaken) {
            return next(new AppError("This contact number is already in use by another user.", 400));
        }

        const updateData = { contact, role_id };

        // 3. Password handling (If provided)
        if (password) {
            if (password !== confirmPassword) {
                return next(new AppError("Passwords do not match.", 400));
            }
            if (password.length < 6) {
                return next(new AppError("Password must be at least 6 characters.", 400));
            }
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        // 4. Update in Database
        const result = await User.updateUser(userId, updateData);

        if (result.affectedRows === 0) {
            return next(new AppError("User not found or no changes made.", 404));
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully."
        });
    })

};

module.exports = userController;