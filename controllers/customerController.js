const prisma = require('../config/prismaClient');
const catchAsync = require("../utils/catchAsync");
const { AppError } = require("../middleware/errorHandler");
const PaginationHelper = require('../utils/paginationHelper');

const customerController = {
    // Add a new customer
    addCustomer: catchAsync(async (req, res, next) => {
        const { name, contact, email } = req.body;

        // Check if phone number already exists
        const existing = await prisma.customer.findFirst({
            where: { contact }
        });

        if (existing) {
            return next(new AppError("This phone number already exists in the system.", 400));
        }

        const customer = await prisma.customer.create({
            data: {
                name,
                contact,
                email: email || null,
                status_id: 1
            },
            include: {
                status: {
                    select: {
                        ststus: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: "Customer added successfully",
            data: {
                ...customer,
                status_name: customer.status.ststus
            }
        });
    }),

    // Get all customers with pagination
    getAllCustomers: catchAsync(async (req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = PaginationHelper.getSkip(page, limit);

        // 1. Get total count and customers in parallel
        const [totalCount, customers] = await Promise.all([
            prisma.customer.count(),
            prisma.customer.findMany({
                skip: skip,
                take: limit,
                include: {
                    status: {
                        select: {
                            ststus: true
                        }
                    }
                },
                orderBy: {
                    id: 'desc'
                }
            })
        ]);

        // 2. Optimized: Get all credit balances for these customers in a single query
        const customerIds = customers.map(c => c.id);
        
        const creditData = await prisma.invoice.findMany({
            where: {
                customer_id: { in: customerIds }
            },
            select: {
                customer_id: true,
                creadit_book: {
                    select: {
                        balance: true
                    }
                }
            }
        });

        // 3. Calculate total credit balance per customer
        const creditBalanceMap = new Map();
        creditData.forEach(invoice => {
            const currentBalance = creditBalanceMap.get(invoice.customer_id) || 0;
            const invoiceBalance = invoice.creadit_book.reduce((sum, cb) => sum + cb.balance, 0);
            creditBalanceMap.set(invoice.customer_id, currentBalance + invoiceBalance);
        });

        // 4. Map everything together in memory
        const formattedCustomers = customers.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            contact: c.contact,
            credit_balance: creditBalanceMap.get(c.id) || 0,
            status_name: c.status?.ststus,
            status_id: c.status_id,
            joinedDate: c.created_at?.toISOString().split('T')[0]
        }));
        
        res.status(200).json({
            success: true,
            data: formattedCustomers,
            pagination: PaginationHelper.getPaginationMetadata(page, limit, totalCount)
        });
    }),

    // Toggle customer status
    toggleStatus: catchAsync(async (req, res, next) => {
        const { customerId } = req.params;
        const { isActive } = req.body;

        // Map boolean isActive to status_id (1 for Active, 2 for Inactive)
        const status_id = isActive ? 1 : 2;

        const result = await prisma.customer.update({
            where: { id: parseInt(customerId) },
            data: { status_id }
        });

        res.status(200).json({
            success: true,
            message: `Customer status updated to ${isActive ? 'Active' : 'Inactive'}.`,
            data: { customerId, status_id }
        });
    }),
    
    // Update customer phone number
    updatePhone: catchAsync(async (req, res, next) => {
        const { customerId } = req.params;
        const { phone } = req.body;

        // 1. Check if the phone number is already taken by another customer
        const existing = await prisma.customer.findFirst({
            where: {
                contact: phone,
                id: { not: parseInt(customerId) }
            }
        });

        if (existing) {
            return next(new AppError("This contact number is already assigned to another customer.", 400));
        }

        // 2. Update the contact number in the database
        const result = await prisma.customer.update({
            where: { id: parseInt(customerId) },
            data: { contact: phone }
        });

        res.status(200).json({
            success: true,
            message: "Customer contact number updated successfully.",
            data: { customerId, newPhone: phone }
        });
    }),

    // Update customer all details
    updateCustomer: catchAsync(async (req, res, next) => {
        const { customerId } = req.params;
        const { name, contact, email } = req.body;

        if (!name || !contact) {
            return next(new AppError("Name and contact number are required.", 400));
        }

        // Check if the contact number is already taken by another customer
        const existing = await prisma.customer.findFirst({
            where: {
                contact: contact,
                id: { not: parseInt(customerId) }
            }
        });

        if (existing) {
            return next(new AppError("This contact number is already assigned to another customer.", 400));
        }

        const customer = await prisma.customer.update({
            where: { id: parseInt(customerId) },
            data: {
                name,
                contact,
                email: email || null
            }
        });

        res.status(200).json({
            success: true,
            message: "Customer updated successfully.",
            data: customer
        });
    }),

    // Search customers by name
    searchCustomers: catchAsync(async (req, res, next) => {
        const { query } = req.query; 

        if (!query) {
            return next(new AppError("Search query is required.", 400));
        }

        const customers = await prisma.customer.findMany({
            where: {
                OR: [
                    { name: { contains: query } },
                    { contact: { contains: query } }
                ]
            },
            include: {
                status: {
                    select: {
                        ststus: true
                    }
                },
                invoice: {
                    include: {
                        creadit_book: true
                    }
                }
            },
            take: 10
        });

        // Calculate credit balance for each customer from creadit_book
        const formattedCustomers = customers.map(c => {
            // Sum all credit book balances for this customer's invoices
            const creditBalance = c.invoice.reduce((total, inv) => {
                const invoiceCredit = inv.creadit_book.reduce((sum, cb) => sum + cb.balance, 0);
                return total + invoiceCredit;
            }, 0);

            return {
                ...c,
                credit_balance: creditBalance,
                status_name: c.status.ststus,
                invoice: undefined // Remove invoice details from response
            };
        });

        res.status(200).json({
            success: true,
            data: formattedCustomers
        });
    })
};

module.exports = customerController;