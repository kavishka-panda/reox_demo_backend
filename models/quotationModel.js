const prisma = require("../config/prismaClient");
const PaginationHelper = require('../utils/paginationHelper');

class Quotation {
    static async create(data) {
        // data: { customer_id, user_id, sub_total, discount, total, items: [{ stock_id, price, discount_amount, qty, total }] }
        
        // Generate Quotation Number (QT-YYYYMMDD-XXXX)
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;

        // Find the last quotation created today to get the next sequence number
        const startOfToday = new Date(date);
        startOfToday.setHours(0, 0, 0, 0);

        const lastQuotationToday = await prisma.quotation.findFirst({
            where: {
                created_at: {
                    gte: startOfToday
                }
            },
            orderBy: {
                id: 'desc'
            },
            select: {
                quotation_number: true
            }
        });

        let nextSequence = 1;
        if (lastQuotationToday) {
            const lastNumber = lastQuotationToday.quotation_number;
            const parts = lastNumber.split('-');
            const lastSeqStr = parts[parts.length - 1];
            const lastSeq = parseInt(lastSeqStr);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }

        const quotationNumber = `QT-${dateString}-${String(nextSequence).padStart(4, '0')}`;
        
        const validUntil = new Date(date);
        validUntil.setDate(validUntil.getDate() + 7); // Default +7 days

        return prisma.quotation.create({
            data: {
                quotation_number: quotationNumber,
                customer_id: data.customer_id,
                user_id: data.user_id,
                sub_total: data.sub_total,
                discount: data.discount,
                total: data.total,
                created_at: date,
                valid_until: data.valid_until ? new Date(data.valid_until) : validUntil,
                quotation_items: {
                    create: data.items.map(item => ({
                        stock_id: item.id, // item.id is stockID from frontend
                        price: item.mrp,   // item.mrp is original price
                        discount_amount: item.discount, // item.discount is total discount for line
                        qty: item.qty,
                        total: item.amount // net amount for line
                    }))
                }
            },
            include: {
                quotation_items: {
                    include: {
                        stock: {
                            include: {
                                product_variations: {
                                    include: {
                                        product: {
                                            include: {
                                                unit_id_product_unit_idTounit_id: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                customer: true,
                user: true
            }
        });
    }

    static async getById(id) {
        return prisma.quotation.findUnique({
            where: { id: parseInt(id) },
            include: {
                quotation_items: {
                    include: {
                        stock: {
                            include: {
                                product_variations: {
                                    include: {
                                        product: {
                                            include: {
                                                unit_id_product_unit_idTounit_id: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                customer: true,
                user: true
            }
        });
    }
    static async getAll({ quotationNumber, fromDate, toDate, customerId, page = 1, limit = 10 }) {
        const skip = PaginationHelper.getSkip(page, limit);
        const where = {};

        if (quotationNumber) {
            where.quotation_number = { contains: quotationNumber };
        }

        if (fromDate || toDate) {
            where.created_at = {};
            if (fromDate) where.created_at.gte = new Date(fromDate);
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.created_at.lte = endDate;
            }
        }

        if (customerId) {
            where.customer_id = parseInt(customerId);
        }

        // Run count and findMany in parallel for better performance
        const [totalCount, quotations] = await Promise.all([
            prisma.quotation.count({ where }),
            prisma.quotation.findMany({
                where,
                skip: skip,
                take: parseInt(limit),
                orderBy: { created_at: 'desc' },
                include: {
                    customer: true,
                    user: true,
                    quotation_items: {
                        include: {
                            stock: {
                                include: {
                                    product_variations: {
                                        include: {
                                            product: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
        ]);

        return {
            data: quotations,
            pagination: PaginationHelper.getPaginationMetadata(page, limit, totalCount)
        };
    }

    static async update(id, data) {
        // data: { customer_id, user_id, sub_total, discount, total, items: [{ stock_id, price, discount_amount, qty, total }], valid_until, remarks }
        
        return prisma.$transaction(async (tx) => {
            // 1. Delete existing items one-by-one so each delete is captured in outbox middleware.
            const existingItems = await tx.quotation_items.findMany({
                where: { quotation_id: parseInt(id) },
                select: { id: true }
            });

            for (const item of existingItems) {
                await tx.quotation_items.delete({
                    where: { id: item.id }
                });
            }

            // Prepare non-null data
            const updateData = {
                customer_id: data.customer_id,
                sub_total: data.sub_total,
                discount: data.discount,
                total: data.total,
                remarks: data.remarks,
                quotation_items: {
                    create: data.items.map(item => ({
                        stock_id: item.id,
                        price: item.mrp,
                        discount_amount: item.discount,
                        qty: item.qty,
                        total: item.amount
                    }))
                }
            };

            if (data.user_id) updateData.user_id = data.user_id;
            if (data.valid_until) updateData.valid_until = new Date(data.valid_until);

            // 2. Update quotation record and create new items
            return tx.quotation.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: {
                    quotation_items: {
                        include: {
                            stock: {
                                include: {
                                    product_variations: {
                                        include: {
                                            product: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    customer: true,
                    user: true
                }
            });
        });
    }
}

module.exports = Quotation;
