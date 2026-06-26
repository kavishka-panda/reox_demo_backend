const prisma = require("../config/prismaClient");

class GRN {

    static async createGRN(data) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Determine GRN status based on balance
                const grnStatusId = data.balance > 0 ? 1 : 2;

                // Create GRN with items and payment in a single transaction
                const grn = await tx.grn.create({
                    data: {
                        bill_number: data.billNumber,
                        supplier_id: data.supplierId,
                        total: data.grandTotal,
                        paid_amount: data.paidAmount,
                        balance: data.balance,
                        grn_status_id: grnStatusId,
                        grn_items: {
                            create: await Promise.all(data.items.map(async (item) => {
                                // Check if batch exists
                                let batch = await tx.batch.findFirst({
                                    where: { batch_name: item.batchIdentifier }
                                });

                                // Create batch if it doesn't exist
                                if (!batch) {
                                    batch = await tx.batch.create({
                                        data: { batch_name: item.batchIdentifier }
                                    });
                                }

                                // Create stock entry
                                const stock = await tx.stock.create({
                                    data: {
                                        product_variations_id: item.variantId,
                                        barcode: item.barcode,
                                        batch_id: batch.id,
                                        mfd: item.mfd ? new Date(item.mfd) : null,
                                        exp: item.exp ? new Date(item.exp) : null,
                                        cost_price: item.costPrice,
                                        mrp: item.mrp,
                                        rsp: item.rsp,
                                        wsp: item.wsp,
                                        qty: item.qty,
                                        free_qty: item.freeQty
                                    }
                                });

                                // Return grn_items data
                                return {
                                    stock_id: stock.id,
                                    qty: item.qty,
                                    free_qty: item.freeQty
                                };
                            }))
                        },
                        grn_payments: data.paidAmount > 0 ? {
                            create: {
                                paid_amount: data.paidAmount,
                                payment_types_id: data.paymentMethodId
                            }
                        } : undefined
                    }
                });

                return grn.id;
            });
        } catch (error) {
            throw error;
        }
    }

    static async getGRNSummary() {
        const result = await prisma.grn.aggregate({
            _count: { id: true },
            _sum: {
                total: true,
                paid_amount: true,
                balance: true
            }
        });

        return {
            totalGrnCount: result._count.id || 0,
            totalAmount: result._sum.total || 0,
            totalPaid: result._sum.paid_amount || 0,
            totalBalance: result._sum.balance || 0
        };
    }

    static async getAllGRNs(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // Run count and findMany in parallel for better performance
        const [totalCount, grns] = await Promise.all([
            prisma.grn.count(),
            prisma.grn.findMany({
                skip: skip,
                take: limit,
                include: {
                    supplier: {
                        select: {
                            id: true,
                            supplier_name: true
                        }
                    },
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

        return {
            data: grns.map(g => ({
                id: g.id,
                supplierName: g.supplier.supplier_name,
                supplierId: g.supplier.id,
                billNumber: g.bill_number,
                totalAmount: g.total,
                paidAmount: g.paid_amount,
                balanceAmount: g.balance,
                grnDate: this.formatDateTime(g.create_at),
                statusName: g.status.ststus
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount,
                recordsPerPage: limit
            }
        };
    }

    static async searchGRNs(filters, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const whereClause = {};

        if (filters.supplierName) {
            whereClause.supplier = {
                supplier_name: {
                    contains: filters.supplierName
                }
            };
        }

        if (filters.billNumber) {
            whereClause.bill_number = {
                contains: filters.billNumber
            };
        }

        if (filters.fromDate && filters.toDate) {
            const endDate = new Date(filters.toDate);
            endDate.setHours(23, 59, 59, 999);
            
            whereClause.create_at = {
                gte: new Date(filters.fromDate),
                lte: endDate
            };
        }

        // Run count and findMany in parallel for better performance
        const [totalCount, grns] = await Promise.all([
            prisma.grn.count({
                where: whereClause
            }),
            prisma.grn.findMany({
                where: whereClause,
                skip: skip,
                take: limit,
                include: {
                    supplier: {
                        select: {
                            id: true,
                            supplier_name: true
                        }
                    },
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

        return {
            data: grns.map(g => ({
                id: g.id,
                supplierName: g.supplier.supplier_name,
                supplierId: g.supplier.id,
                billNumber: g.bill_number,
                totalAmount: g.total,
                paidAmount: g.paid_amount,
                balanceAmount: g.balance,
                grnDate: this.formatDateTime(g.create_at),
                statusName: g.status.ststus
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount,
                recordsPerPage: limit
            }
        };
    }

    // Fetch Bill Numbers for a specific supplier with active status
    static async getActiveBillNumbersBySupplier(supplierId) {
        const grns = await prisma.grn.findMany({
            where: {
                supplier_id: parseInt(supplierId),
                grn_status_id: 1
            },
            select: {
                id: true,
                bill_number: true,
                total: true,
                balance: true
            },
            orderBy: {
                create_at: 'desc'
            }
        });

        return grns;
    }

    static async getGRNDetailsById(id) {
        const grn = await prisma.grn.findUnique({
            where: { id: parseInt(id) },
            include: {
                supplier: {
                    select: {
                        id: true,
                        supplier_name: true
                    }
                },
                status: {
                    select: {
                        ststus: true
                    }
                },
                grn_items: {
                    include: {
                        stock: {
                            include: {
                                product_variations: {
                                    include: {
                                        product: {
                                            select: {
                                                product_name: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                grn_payments: {
                    include: {
                        payment_types: {
                            select: {
                                payment_types: true
                            }
                        }
                    },
                    orderBy: {
                        created_at: 'desc'
                    }
                }
            }
        });

        if (!grn) return null;

        return {
            id: grn.id,
            supplierName: grn.supplier.supplier_name,
            supplierId: grn.supplier.id,
            billNumber: grn.bill_number,
            totalAmount: grn.total,
            paidAmount: grn.paid_amount,
            balanceAmount: grn.balance,
            grnDate: this.formatDateTime(grn.create_at, 'YYYY-MM-DD hh:mm A'),
            statusName: grn.status.ststus,
            items: grn.grn_items.map(item => ({
                id: item.id,
                itemName: item.stock.product_variations.product.product_name,
                quantity: item.qty,
                unitPrice: item.stock.cost_price,
                totalPrice: item.qty * item.stock.cost_price,
                expiryDate: item.stock.exp ? item.stock.exp.toISOString().split('T')[0] : null
            })),
            payments: grn.grn_payments.map(payment => ({
                id: payment.id,
                amount: payment.paid_amount,
                date: this.formatDateTime(payment.created_at),
                type: payment.payment_types.payment_types
            }))
        };
    }

    static async updatePayment(data) {
        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Fetch current balance and paid amount for validation
                const grn = await tx.grn.findUnique({
                    where: { id: data.grn_id },
                    select: {
                        balance: true,
                        paid_amount: true
                    }
                });

                if (!grn) throw new Error("GRN record not found.");

                const { balance, paid_amount } = grn;

                // 2. Validation: Ensure new payment is not greater than current balance
                if (parseFloat(data.payment_amount) > parseFloat(balance)) {
                    throw new Error(`Invalid Amount. Maximum payable balance is LKR ${balance}`);
                }

                // 3. Calculate new values
                const newBalance = parseFloat(balance) - parseFloat(data.payment_amount);
                const newPaidAmount = parseFloat(paid_amount) + parseFloat(data.payment_amount);
                
                // If balance becomes 0, status_id becomes 2 (Paid), else stays 1 (Pending)
                const newStatusId = newBalance === 0 ? 2 : 1;

                // 4. Update grn table
                await tx.grn.update({
                    where: { id: data.grn_id },
                    data: {
                        balance: newBalance,
                        paid_amount: newPaidAmount,
                        grn_status_id: newStatusId
                    }
                });

                // 5. Insert record into grn_payment table
                await tx.grn_payments.create({
                    data: {
                        grn_id: data.grn_id,
                        paid_amount: parseFloat(data.payment_amount),
                        payment_types_id: data.payment_type_id
                    }
                });

                return { success: true, remainingBalance: newBalance };
            });
        } catch (error) {
            throw error;
        }
    }

    // Helper method to format datetime
    static formatDateTime(date, format = '%Y.%m.%d %h:%i %p') {
        if (!date) return null;
        const d = new Date(date);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        
        return `${year}.${month}.${day} ${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
    }
}

module.exports = GRN;