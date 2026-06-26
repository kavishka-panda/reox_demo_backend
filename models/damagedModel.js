const prisma = require('../config/prismaClient');

class Damaged {
    static async addDamagedStock(data) {
        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Check current stock level and lock the row for update
                const stockId = parseInt(data.stock_id);
                const damagedQty = parseFloat(data.qty);
                const reasonId = parseInt(data.reason_id);
                const statusId = parseInt(data.status_id);

                const stock = await tx.stock.findUnique({
                    where: { id: stockId },
                    select: { qty: true }
                });

                if (!stock) {
                    throw new Error("Stock record not found.");
                }

                const currentQty = stock.qty;

                // 2. Validate if the damaged quantity is more than available stock
                if (currentQty < damagedQty) {
                    throw new Error(`Insufficient stock. Available quantity is only ${currentQty}`);
                }

                // 3. Insert record into the damaged table
                await tx.damaged.create({
                    data: {
                        stock_id: stockId,
                        qty: damagedQty,
                        reason_id: reasonId,
                        description: data.description,
                        date: new Date(),
                        return_status_id: statusId
                    }
                });

                // 4. Update (deduct) the quantity in the stock table
                await tx.stock.update({
                    where: { id: stockId },
                    data: {
                        qty: {
                            decrement: damagedQty
                        }
                    }
                });

                return { success: true };
            });
        } catch (error) {
            throw error;
        }
    }

    // Get all damaged records for the table display
    static async getAllDamagedRecords(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalCount = await prisma.damaged.count();

        const damagedRecords = await prisma.damaged.findMany({
            skip: skip,
            take: limit,
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
                        },
                        batch: true,
                        grn_items: {
                            include: {
                                grn: {
                                    include: {
                                        supplier: true
                                    }
                                }
                            },
                            take: 1
                        }
                    }
                },
                reason: true,
                return_status: true
            },
            orderBy: {
                id: 'desc'
            }
        });

        const data = damagedRecords.map(d => {
            const stock = d.stock;
            const product = stock.product_variations.product;
            const supplier = stock.grn_items[0]?.grn?.supplier;

            return {
                damaged_id: d.id,
                product_id_code: product.id,
                product_name: product.product_name,
                unit: product.unit_id_product_unit_idTounit_id?.name,
                damaged_qty: d.qty,
                cost_price: stock.cost_price,
                mrp: stock.mrp,
                price: stock.rsp,
                supplier: supplier?.supplier_name,
                stock_label: stock.batch?.batch_name,
                damage_reason: d.reason.reason,
                status: d.return_status.return_status,
                description: d.description,
                date: d.date
            };
        });

        return {
            data: data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    }

    // Fetch filtered records from the damaged table
    static async searchDamagedRecords(filters, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // Build where clause for database-level filtering
        const whereClause = {};

        // Build nested conditions
        if (filters.productName && filters.productName.trim()) {
            whereClause.stock = {
                product_variations: {
                    is: {
                        product: {
                            is: {
                                product_name: {
                                    contains: filters.productName.trim()
                                }
                            }
                        }
                    }
                }
            };
        }

        // Date range filter
        if (filters.fromDate && filters.toDate) {
            const fromDate = new Date(filters.fromDate);
            const toDate = new Date(filters.toDate);
            toDate.setHours(23, 59, 59, 999);
            
            whereClause.date = {
                gte: fromDate,
                lte: toDate
            };
        }

        // Get total count with filters
        const totalCount = await prisma.damaged.count({
            where: whereClause
        });

        // Fetch paginated records with filters
        const damagedRecords = await prisma.damaged.findMany({
            where: whereClause,
            skip: skip,
            take: limit,
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
                        },
                        batch: true,
                        grn_items: {
                            include: {
                                grn: {
                                    include: {
                                        supplier: true
                                    }
                                }
                            },
                            take: 1
                        }
                    }
                },
                reason: true,
                return_status: true
            },
            orderBy: {
                id: 'desc'
            }
        });

        const data = damagedRecords.map(d => {
            const stock = d.stock;
            const product = stock.product_variations.product;
            const supplier = stock.grn_items[0]?.grn?.supplier;

            return {
                damaged_id: d.id,
                product_id_code: product.id,
                product_name: product.product_name,
                unit: product.unit_id_product_unit_idTounit_id?.name,
                damaged_qty: d.qty,
                cost_price: stock.cost_price,
                mrp: stock.mrp,
                price: stock.rsp,
                supplier: supplier?.supplier_name,
                stock_label: stock.batch?.batch_name,
                damage_reason: d.reason.reason,
                status: d.return_status.return_status,
                description: d.description,
                date: d.date
            };
        });

        return {
            data: data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    }

    // Get summary statistics for the Damaged Stock dashboard
    static async getDamagedSummary() {
        const damagedRecords = await prisma.damaged.findMany({
            include: {
                stock: {
                    include: {
                        product_variations: {
                            select: {
                                product_id: true
                            }
                        },
                        grn_items: {
                            include: {
                                grn: {
                                    select: {
                                        supplier_id: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Calculate statistics in JavaScript
        const uniqueProducts = new Set();
        const uniqueSuppliers = new Set();
        let totalLossValue = 0;
        let totalDamagedQty = 0;
        let thisMonthQty = 0;

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        damagedRecords.forEach(d => {
            uniqueProducts.add(d.stock.product_variations.product_id);
            totalLossValue += d.qty * d.stock.cost_price;
            totalDamagedQty += d.qty;

            // Check if damage is from current month
            const damageDate = new Date(d.date);
            if (damageDate.getMonth() === currentMonth && damageDate.getFullYear() === currentYear) {
                thisMonthQty += d.qty;
            }

            // Collect unique suppliers
            d.stock.grn_items.forEach(gi => {
                if (gi.grn?.supplier_id) {
                    uniqueSuppliers.add(gi.grn.supplier_id);
                }
            });
        });

        return {
            damaged_items_count: totalDamagedQty,
            total_products_affected: uniqueProducts.size,
            total_loss_value: totalLossValue,
            this_month_count: thisMonthQty,
            affected_suppliers_count: uniqueSuppliers.size
        };
    }

    static async updateStatus(id, statusId) {
        try {
            await prisma.damaged.update({
                where: { id: parseInt(id) },
                data: {
                    return_status_id: parseInt(statusId)
                }
            });
            return { success: true };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Damaged;