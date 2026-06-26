const prisma = require("../config/prismaClient");

class Stock {
    /**
     * @desc Get ALL stock data with individual variation rows (not grouped)
     */
    static async getAllStockWithVariations(filters = {}) {
        const whereClause = {};

        if (filters.hasStock) {
            whereClause.qty = { gt: 0 };
        }

        const stocks = await prisma.stock.findMany({
            where: whereClause,
            include: {
                product_variations: {
                    include: {
                        product: {
                            include: {
                                unit_id_product_unit_idTounit_id: true,
                                category: true,
                                brand: true
                            }
                        },
                        product_status: true
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
            },
            orderBy: [
                { id: 'desc' }
            ],
            take: filters.limit ? parseInt(filters.limit) : undefined
        });

        return stocks.map(s => {
            const pv = s.product_variations;
            const p = pv.product;
            const supplier = s.grn_items[0]?.grn?.supplier;

            // Build full product name - Only include meaningful variants
            const variations = [pv.color, pv.size, pv.storage_capacity]
                .filter(v => v && !['n/a', 'na', 'n.a.', 'none', 'default', 'not applicable'].includes(v.toLowerCase().trim()) && v.trim() !== '');

            let fullProductName = p.product_name;
            if (variations.length > 0) {
                fullProductName += ` - ${variations.join(' - ')}`;
            }

            return {
                stock_id: s.id,
                product_variations_id: s.product_variations_id,
                batch_id: s.batch_id,
                qty: s.qty,
                cost_price: s.cost_price,
                mrp: s.mrp,
                selling_price: s.rsp,
                wsp: s.wsp,
                mfd: s.mfd,
                exp: s.exp,
                product_id: p.id,
                product_name: p.product_name,
                product_code: p.product_code,
                barcode: s.barcode,
                color: pv.color,
                size: pv.size,
                storage_capacity: pv.storage_capacity,
                full_product_name: fullProductName,
                unit: p.unit_id_product_unit_idTounit_id?.name,
                unit_conversion: null,
                category: p.category?.name,
                brand: p.brand?.name,
                batch_name: s.batch?.batch_name,
                supplier: supplier?.supplier_name,
                product_status: pv.product_status?.status_name
            };
        });
    }

    /**
     * @desc Get all current stock with product and supplier details (grouped by product)
     */
    static async getAllStock(page = 1, limit = 10) {
        return this.searchStock({}, page, limit);
    }

    static async searchStock(filters, page = 1, limit = 10) {
        const whereClause = {
            qty: { gt: 0 }
        };

        if (filters.category) {
            whereClause.product_variations = {
                product: {
                    category_id: parseInt(filters.category)
                }
            };
        }

        if (filters.unit) {
            if (!whereClause.product_variations) whereClause.product_variations = { product: {} };
            whereClause.product_variations.product.unit_id = parseInt(filters.unit);
        }

        if (filters.supplier) {
            whereClause.grn_items = {
                some: {
                    grn: {
                        supplier_id: parseInt(filters.supplier)
                    }
                }
            };
        }

        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            whereClause.OR = [
                {
                    product_variations: {
                        product: {
                            OR: [
                                { product_name: { contains: query } },
                                { product_code: { contains: query } }
                            ]
                        }
                    }
                },
                { barcode: { contains: query } },
                { product_variations: { barcode: { contains: query } } }
            ];

            // If query is a number, also check ID
            const numericId = parseInt(query);
            if (!isNaN(numericId)) {
                whereClause.OR.push({
                    product_variations: {
                        product: {
                            id: numericId
                        }
                    }
                });
            }
        }

        // Get total count for pagination
        const totalCount = await prisma.stock.count({
            where: whereClause
        });

        const skip = (page - 1) * limit;

        // Fetch paginated stocks with relations using Prisma
        const stocks = await prisma.stock.findMany({
            where: whereClause,
            include: {
                product_variations: {
                    include: {
                        product: {
                            include: {
                                unit_id_product_unit_idTounit_id: true,
                                category: true,
                                brand: true
                            }
                        },
                        product_status: true
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
            },
            take: limit,
            skip: skip,
            orderBy: {
                id: 'desc'
            }
        });

        // Map to individual items (no grouping)
        const result = stocks.map(s => {
            const pv = s.product_variations;
            const p = pv.product;
            const supplier = s.grn_items[0]?.grn?.supplier;

            // Build full product name - Only include meaningful variants
            const variations = [pv.color, pv.size, pv.storage_capacity]
                .filter(v => v && !['n/a', 'na', 'n.a.', 'none', 'default', 'not applicable'].includes(v.toLowerCase().trim()) && v.trim() !== '');

            let fullProductName = p.product_name;
            if (variations.length > 0) {
                fullProductName += ` - ${variations.join(' - ')}`;
            }

            return {
                stock_id: s.id,
                product_variations_id: s.product_variations_id,
                batch_id: s.batch_id,
                qty: s.qty,
                cost_price: s.cost_price,
                mrp: s.mrp,
                selling_price: s.rsp,
                wsp: s.wsp,
                mfd: s.mfd,
                exp: s.exp,
                product_id: p.id,
                product_name: p.product_name,
                full_product_name: fullProductName,
                product_code: p.product_code,
                barcode: s.barcode,
                color: pv.color,
                size: pv.size,
                storage_capacity: pv.storage_capacity,
                unit: p.unit_id_product_unit_idTounit_id?.name,
                category: p.category?.name,
                brand: p.brand?.name,
                batch_name: s.batch?.batch_name,
                supplier: supplier?.supplier_name,
                product_status: pv.product_status?.status_name
            };
        });

        return {
            data: result,
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

    static async getDashboardSummary() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Total Active Products
        const totalProducts = await prisma.product_variations.groupBy({
            by: ['product_id'],
            where: { product_status_id: 1 },
            _count: true
        });

        // Total Stock Value for current month
        const stockValue = await prisma.stock.aggregate({
            where: {
                mfd: {
                    gte: new Date(currentYear, currentMonth - 1, 1),
                    lt: new Date(currentYear, currentMonth, 1)
                }
            },
            _sum: {
                cost_price: true,
                qty: true
            }
        });

        // Low Stock Items
        const lowStock = await prisma.stock.count({
            where: {
                qty: { lt: 5 },
                product_variations: {
                    product_status_id: 1
                }
            }
        });

        // Total Active Suppliers
        const totalSuppliers = await prisma.supplier.count({
            where: { status_id: 1 }
        });

        // Total Categories
        const totalCategories = await prisma.category.count();

        return {
            totalProducts: totalProducts.length || 0,
            totalValue: (stockValue._sum.cost_price || 0) * (stockValue._sum.qty || 0),
            lowStock: lowStock || 0,
            totalSuppliers: totalSuppliers || 0,
            totalCategories: totalCategories || 0
        };
    }

   static async getOutOfStock(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    // Get ALL stock records to properly calculate total qty per product variation
    const stockRecords = await prisma.stock.findMany({
        select: {
            product_variations_id: true,
            qty: true,
            cost_price: true,
            mrp: true,
            rsp: true
        }
    });

    // Group by product_variations_id and aggregate
    const groupedStock = stockRecords.reduce((acc, record) => {
        const pvId = record.product_variations_id;
        if (!acc[pvId]) {
            acc[pvId] = {
                product_variations_id: pvId,
                totalQty: 0,
                costPrices: [],
                mrps: [],
                rsps: [],
                count: 0
            };
        }
        acc[pvId].totalQty += record.qty || 0;
        acc[pvId].costPrices.push(record.cost_price || 0);
        acc[pvId].mrps.push(record.mrp || 0);
        acc[pvId].rsps.push(record.rsp || 0);
        acc[pvId].count++;
        return acc;
    }, {});

    // Convert to array and filter where total qty <= 0
    const variationsWithZeroStock = Object.values(groupedStock)
        .filter(group => group.totalQty <= 0)
        .sort((a, b) => a.product_variations_id - b.product_variations_id);

    const totalCount = variationsWithZeroStock.length;
    const paginatedGroups = variationsWithZeroStock.slice(skip, skip + limit);

    const results = await Promise.all(paginatedGroups.map(async (group) => {
        const pv = await prisma.product_variations.findUnique({
            where: { id: group.product_variations_id },
            include: {
                product: {
                    include: { unit_id_product_unit_idTounit_id: true }
                }
            }
        });

        if (!pv) return null;

        // Get the most recent stock record with supplier info
        const stockWithSupplier = await prisma.stock.findFirst({
            where: { product_variations_id: group.product_variations_id },
            include: {
                grn_items: {
                    include: {
                        grn: {
                            include: {
                                supplier: true
                            }
                        }
                    },
                    orderBy: { id: 'desc' },
                    take: 1
                }
            },
            orderBy: { id: 'desc' }
        });

        const supplier = stockWithSupplier?.grn_items[0]?.grn?.supplier;

        const vParts = [pv.color, pv.size, pv.storage_capacity]
            .filter(v => v && !['n/a', 'none', 'default', 'na'].includes(v.toLowerCase().trim()));

        // Calculate averages
        const avgCostPrice = group.costPrices.reduce((a, b) => a + b, 0) / group.costPrices.length;
        const avgMrp = group.mrps.reduce((a, b) => a + b, 0) / group.mrps.length;
        const avgRsp = group.rsps.reduce((a, b) => a + b, 0) / group.rsps.length;

        return {
            product_variations_id: group.product_variations_id,
            product_id: pv.product.product_code || pv.product.id.toString(),
            product_name: vParts.length > 0 ? `${pv.product.product_name} - ${vParts.join(' - ')}` : pv.product.product_name,
            unit: pv.product.unit_id_product_unit_idTounit_id?.name,
            cost_price: avgCostPrice,
            mrp: avgMrp,
            selling_price: avgRsp,
            stock_qty: group.totalQty,
            supplier: supplier?.supplier_name || 'N/A'
        };
    }));

    // Filter out any null results
    const filteredResults = results.filter(r => r !== null);

    return {
        data: filteredResults,
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

    static async searchOutOfStock(filters, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // 1. Build Database-level where clause - get ALL stock records (not filtered by qty)
        const whereClause = {};

        // Search query (Name, Code, or ID)
        if (filters.searchQuery) {
            const query = filters.searchQuery.trim();
            whereClause.product_variations = {
                product: {
                    OR: [
                        { product_name: { contains: query } },
                        { product_code: { contains: query } },
                        { id: !isNaN(query) ? parseInt(query) : undefined }
                    ].filter(Boolean)
                }
            };
        }

        // Category filter
        if (filters.category) {
            if (!whereClause.product_variations) whereClause.product_variations = { product: {} };
            whereClause.product_variations.product.category_id = parseInt(filters.category);
        }

        // Supplier filter
        if (filters.supplier) {
            whereClause.grn_items = {
                some: {
                    grn: { supplier_id: parseInt(filters.supplier) }
                }
            };
        }

        // Date range filter (MFD base කරගෙන)
        if (filters.fromDate && filters.toDate) {
            whereClause.mfd = {
                gte: new Date(filters.fromDate),
                lte: new Date(new Date(filters.toDate).setHours(23, 59, 59, 999))
            };
        }

        // 2. Fetch ALL matching stock records (not filtered by qty at database level)
        const stocks = await prisma.stock.findMany({
            where: whereClause,
            select: {
                product_variations_id: true,
                qty: true,
                cost_price: true,
                mrp: true,
                rsp: true
            }
        });

        // Group by product_variations_id and sum quantities
        const groupedStock = stocks.reduce((acc, record) => {
            const pvId = record.product_variations_id;
            if (!acc[pvId]) {
                acc[pvId] = {
                    product_variations_id: pvId,
                    totalQty: 0,
                    costPrices: [],
                    mrps: [],
                    rsps: [],
                    count: 0
                };
            }
            acc[pvId].totalQty += record.qty || 0;
            acc[pvId].costPrices.push(record.cost_price || 0);
            acc[pvId].mrps.push(record.mrp || 0);
            acc[pvId].rsps.push(record.rsp || 0);
            acc[pvId].count++;
            return acc;
        }, {});

        // Filter variations with total qty <= 0 (out of stock)
        const outOfStockVariations = Object.values(groupedStock)
            .filter(group => group.totalQty <= 0)
            .sort((a, b) => a.product_variations_id - b.product_variations_id);

        const totalCount = outOfStockVariations.length;
        const paginatedGroups = outOfStockVariations.slice(skip, skip + limit);

        // Get product details for paginated results
        const results = await Promise.all(paginatedGroups.map(async (group) => {
            const pv = await prisma.product_variations.findUnique({
                where: { id: group.product_variations_id },
                include: {
                    product: {
                        include: { unit_id_product_unit_idTounit_id: true }
                    }
                }
            });

            if (!pv) return null;

            // Get the most recent stock record with supplier info
            const stockWithSupplier = await prisma.stock.findFirst({
                where: { product_variations_id: group.product_variations_id },
                include: {
                    grn_items: {
                        include: {
                            grn: {
                                include: {
                                    supplier: true
                                }
                            }
                        },
                        orderBy: { id: 'desc' },
                        take: 1
                    }
                },
                orderBy: { id: 'desc' }
            });

            const supplier = stockWithSupplier?.grn_items[0]?.grn?.supplier;

            const vParts = [pv.color, pv.size, pv.storage_capacity]
                .filter(v => v && !['n/a', 'none', 'default', 'na'].includes(v.toLowerCase().trim()));

            // Calculate averages
            const avgCostPrice = group.costPrices.reduce((a, b) => a + b, 0) / group.costPrices.length;
            const avgMrp = group.mrps.reduce((a, b) => a + b, 0) / group.mrps.length;
            const avgRsp = group.rsps.reduce((a, b) => a + b, 0) / group.rsps.length;

            return {
                stock_id: null, // Not applicable for grouped data
                product_variations_id: group.product_variations_id,
                product_id: pv.product.product_code || pv.product.id.toString(),
                product_code: pv.product.product_code,
                qty: group.totalQty,
                cost_price: avgCostPrice,
                mrp: avgMrp,
                selling_price: avgRsp,
                product_name: vParts.length > 0 ? `${pv.product.product_name} - ${vParts.join(' - ')}` : pv.product.product_name,
                barcode: pv.barcode,
                unit: pv.product.unit_id_product_unit_idTounit_id?.name,
                supplier: supplier?.supplier_name || 'N/A',
                batch_name: null // Not applicable for grouped data
            };
        }));

        // Filter out any null results
        const filteredResults = results.filter(r => r !== null);

        return {
            data: filteredResults,
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

    static async getStockByProductVariation(productId) {
        const stocks = await prisma.stock.findMany({
            where: {
                product_variations: {
                    product_id: parseInt(productId)
                },
                qty: { gt: 0 }
            },
            include: {
                product_variations: {
                    include: {
                        product: true
                    }
                },
                batch: true
            },
            orderBy: [
                { product_variations: { id: 'asc' } },
                { batch: { date_time: 'desc' } }
            ]
        });

        return stocks.map(s => {
            const pv = s.product_variations;
            const p = pv.product;

            // Build full product name - Only include meaningful variants
            const variations = [pv.color, pv.size]
                .filter(v => v && !['n/a', 'na', 'n.a.', 'none', 'default', 'not applicable'].includes(v.toLowerCase().trim()) && v.trim() !== '');

            let fullStockDisplay = p.product_name;
            if (variations.length > 0) {
                fullStockDisplay += ` - ${variations.join(' - ')}`;
            }
            fullStockDisplay += ` (${s.batch.batch_name})`;

            return {
                stock_id: s.id,
                full_stock_display: fullStockDisplay,
                available_qty: s.qty,
                selling_price: s.rsp
            };
        });
    }

    // Get all stock items that will expire within N days (default 15) with pagination
    static async getExpireStockRecords(page = 1, limit = 10, days = 15) {
        const skip = (page - 1) * limit;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expireUntil = new Date(today);
        expireUntil.setDate(expireUntil.getDate() + Number(days || 15));
        expireUntil.setHours(23, 59, 59, 999);

        const whereClause = {
            qty: { gt: 0 },
            exp: {
                not: null,
                gte: today,
                lte: expireUntil
            }
        };

        const totalCount = await prisma.stock.count({ where: whereClause });

        const stocks = await prisma.stock.findMany({
            where: whereClause,
            include: {
                product_variations: {
                    include: {
                        product: {
                            include: {
                                unit_id_product_unit_idTounit_id: true,
                                category: true,
                                brand: true
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
                    orderBy: { id: 'desc' },
                    take: 1
                }
            },
            take: limit,
            skip,
            orderBy: {
                exp: 'asc'
            }
        });

        const data = stocks.map(s => {
            const pv = s.product_variations;
            const p = pv.product;
            const supplier = s.grn_items[0]?.grn?.supplier;

            const variations = [pv.color, pv.size, pv.storage_capacity]
                .filter(v => v && !['n/a', 'na', 'n.a.', 'none', 'default', 'not applicable'].includes(v.toLowerCase().trim()) && v.trim() !== '');

            let fullProductName = p.product_name;
            if (variations.length > 0) {
                fullProductName += ` - ${variations.join(' - ')}`;
            }

            return {
                stock_id: s.id,
                product_variations_id: s.product_variations_id,
                product_id: p.id,
                product_code: p.product_code,
                full_product_name: fullProductName,
                barcode: s.barcode,
                qty: s.qty,
                cost_price: s.cost_price,
                mrp: s.mrp,
                selling_price: s.rsp,
                unit: p.unit_id_product_unit_idTounit_id?.name,
                category: p.category?.name,
                brand: p.brand?.name,
                batch_name: s.batch?.batch_name,
                supplier: supplier?.supplier_name || 'N/A',
                mfd: s.mfd,
                exp: s.exp
            };
        });

        return {
            data,
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

    // Get all stock items where quantity is less than 15 with pagination
    static async getLowStockRecords(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const LOW_STOCK_THRESHOLD = 15;

        // Get all stock records with qty > 0
        const stockRecords = await prisma.stock.findMany({
            where: {
                qty: { gt: 0 }
            },
            select: {
                product_variations_id: true,
                qty: true,
                cost_price: true,
                mrp: true,
                rsp: true
            }
        });

        // Group by product_variations_id and sum quantities
        const groupedStock = stockRecords.reduce((acc, record) => {
            const pvId = record.product_variations_id;
            if (!acc[pvId]) {
                acc[pvId] = {
                    product_variations_id: pvId,
                    totalQty: 0,
                    costPrices: [],
                    mrps: [],
                    rsps: [],
                    count: 0
                };
            }
            acc[pvId].totalQty += record.qty || 0;
            acc[pvId].costPrices.push(record.cost_price || 0);
            acc[pvId].mrps.push(record.mrp || 0);
            acc[pvId].rsps.push(record.rsp || 0);
            acc[pvId].count++;
            return acc;
        }, {});

        // Filter variations with total qty < threshold and > 0
        const lowStockVariations = Object.values(groupedStock)
            .filter(group => group.totalQty > 0 && group.totalQty < LOW_STOCK_THRESHOLD)
            .sort((a, b) => a.totalQty - b.totalQty);

        const totalCount = lowStockVariations.length;
        const paginatedGroups = lowStockVariations.slice(skip, skip + limit);

        const results = await Promise.all(paginatedGroups.map(async (group) => {
            const pv = await prisma.product_variations.findUnique({
                where: { id: group.product_variations_id },
                include: {
                    product: {
                        include: { unit_id_product_unit_idTounit_id: true }
                    }
                }
            });

            if (!pv) return null;

            // Get the most recent stock record with supplier info
            const stockWithSupplier = await prisma.stock.findFirst({
                where: { product_variations_id: group.product_variations_id },
                include: {
                    grn_items: {
                        include: {
                            grn: {
                                include: {
                                    supplier: true
                                }
                            }
                        },
                        orderBy: { id: 'desc' },
                        take: 1
                    }
                },
                orderBy: { id: 'desc' }
            });

            const supplier = stockWithSupplier?.grn_items[0]?.grn?.supplier;

            const vParts = [pv.color, pv.size, pv.storage_capacity]
                .filter(v => v && !['n/a', 'none', 'default', 'na'].includes(v.toLowerCase().trim()));

            // Calculate averages
            const avgCostPrice = group.costPrices.reduce((a, b) => a + b, 0) / group.costPrices.length;
            const avgMrp = group.mrps.reduce((a, b) => a + b, 0) / group.mrps.length;
            const avgRsp = group.rsps.reduce((a, b) => a + b, 0) / group.rsps.length;

            return {
                pvId: group.product_variations_id,
                product_id_code: pv.product.product_code,
                product_name: vParts.length > 0 ? `${pv.product.product_name} - ${vParts.join(' - ')}` : pv.product.product_name,
                unit: pv.product.unit_id_product_unit_idTounit_id?.name,
                available_qty: group.totalQty,
                cost_price: avgCostPrice,
                mrp: avgMrp,
                selling_price: avgRsp,
                supplier: supplier?.supplier_name
            };
        }));

        // Filter out any null results
        const filteredResults = results.filter(r => r !== null);

        return {
            data: filteredResults,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: limit,
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    }

    // Search low stock records based on provided filter IDs with pagination
    static async searchLowStock(filters, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const LOW_STOCK_THRESHOLD = 15;

        // Build WHERE condition with all filters at database level
        const whereCondition = {
            qty: { gt: 0 }
        };

        // Product filters
        const productFilters = {};
        if (filters.category_id) {
            productFilters.category_id = parseInt(filters.category_id);
        }
        if (filters.unit_id) {
            productFilters.unit_id = parseInt(filters.unit_id);
        }
        if (filters.product_id) {
            productFilters.id = parseInt(filters.product_id);
        }

        // Add product filters to WHERE condition if any exist
        if (Object.keys(productFilters).length > 0) {
            whereCondition.product_variations = {
                product: productFilters
            };
        }

        // Supplier filter at database level using nested relation
        if (filters.supplier_id) {
            whereCondition.grn_items = {
                some: {
                    grn: {
                        supplier_id: parseInt(filters.supplier_id)
                    }
                }
            };
        }

        // Fetch all matching stock records
        const stocks = await prisma.stock.findMany({
            where: whereCondition,
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
            },
            orderBy: {
                id: 'desc'
            }
        });

        // Group by product_variations_id and sum quantities
        const groupedStock = stocks.reduce((acc, stock) => {
            const pvId = stock.product_variations_id;
            if (!acc[pvId]) {
                acc[pvId] = {
                    product_variations_id: pvId,
                    totalQty: 0,
                    costPrices: [],
                    mrps: [],
                    rsps: [],
                    productVariation: stock.product_variations,
                    latestSupplier: stock.grn_items[0]?.grn?.supplier,
                    count: 0
                };
            }
            acc[pvId].totalQty += stock.qty || 0;
            acc[pvId].costPrices.push(stock.cost_price || 0);
            acc[pvId].mrps.push(stock.mrp || 0);
            acc[pvId].rsps.push(stock.rsp || 0);
            acc[pvId].count++;
            // Update supplier if more recent
            if (stock.grn_items[0]?.grn?.supplier && !acc[pvId].latestSupplier) {
                acc[pvId].latestSupplier = stock.grn_items[0].grn.supplier;
            }
            return acc;
        }, {});

        // Filter variations with total qty < threshold and > 0
        const lowStockVariations = Object.values(groupedStock)
            .filter(group => group.totalQty > 0 && group.totalQty < LOW_STOCK_THRESHOLD)
            .sort((a, b) => a.totalQty - b.totalQty);

        const totalCount = lowStockVariations.length;
        const paginatedGroups = lowStockVariations.slice(skip, skip + limit);

        // Map data
        const data = paginatedGroups.map(group => {
            const product = group.productVariation.product;
            const vParts = [group.productVariation.color, group.productVariation.size, group.productVariation.storage_capacity]
                .filter(v => v && !['n/a', 'none', 'default', 'na'].includes(v.toLowerCase().trim()));

            // Calculate averages
            const avgCostPrice = group.costPrices.reduce((a, b) => a + b, 0) / group.costPrices.length;
            const avgMrp = group.mrps.reduce((a, b) => a + b, 0) / group.mrps.length;
            const avgRsp = group.rsps.reduce((a, b) => a + b, 0) / group.rsps.length;

            return {
                pvId: group.product_variations_id,
                product_id_code: product.product_code,
                product_name: vParts.length > 0 ? `${product.product_name} - ${vParts.join(' - ')}` : product.product_name,
                unit: product.unit_id_product_unit_idTounit_id?.name,
                available_qty: group.totalQty,
                cost_price: avgCostPrice,
                mrp: avgMrp,
                selling_price: avgRsp,
                supplier: group.latestSupplier?.supplier_name
            };
        });

        return {
            data,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: limit,
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    }

    // Get summary data for Out of Stock dashboard
    static async getOutOfStockSummary() {
        const stocks = await prisma.stock.findMany({
            select: {
                product_variations_id: true,
                qty: true,
                mfd: true,
                grn_items: {
                    select: {
                        grn: {
                            select: {
                                supplier_id: true
                            }
                        }
                    }
                },
                product_variations: {
                    select: {
                        product_id: true
                    }
                }
            }
        });

        // Group by product_variations_id and sum quantities
        const groupedStock = stocks.reduce((acc, stock) => {
            const pvId = stock.product_variations_id;
            if (!acc[pvId]) {
                acc[pvId] = {
                    product_variations_id: pvId,
                    product_id: stock.product_variations?.product_id,
                    totalQty: 0,
                    suppliers: new Set(),
                    mfdDates: []
                };
            }
            acc[pvId].totalQty += stock.qty || 0;
            
            stock.grn_items.forEach(gi => {
                if (gi.grn?.supplier_id) {
                    acc[pvId].suppliers.add(gi.grn.supplier_id);
                }
            });

            if (stock.mfd) {
                acc[pvId].mfdDates.push(stock.mfd);
            }

            return acc;
        }, {});

        // Filter for out of stock variations (total qty <= 0)
        const outOfStockVariations = Object.values(groupedStock)
            .filter(group => group.totalQty <= 0);

        // Calculate statistics
        const uniqueProducts = new Set();
        const allSuppliers = new Set();
        const daysOutArray = [];
        const currentDate = new Date();

        outOfStockVariations.forEach(variation => {
            uniqueProducts.add(variation.product_id);
            
            // Add all suppliers for this variation
            variation.suppliers.forEach(supplierId => {
                allSuppliers.add(supplierId);
            });

            // Calculate average days out for this variation
            if (variation.mfdDates.length > 0) {
                variation.mfdDates.forEach(mfdDate => {
                    const daysDiff = Math.floor((currentDate - new Date(mfdDate)) / (1000 * 60 * 60 * 24));
                    daysOutArray.push(daysDiff);
                });
            }
        });

        const avgDaysOut = daysOutArray.length > 0
            ? Math.round((daysOutArray.reduce((a, b) => a + b, 0) / daysOutArray.length) * 10) / 10
            : 0;

        return {
            total_out_of_stock_products: uniqueProducts.size,
            affected_suppliers: allSuppliers.size,
            avg_days_out: avgDaysOut
        };
    }

    static async getLowStockSummary() {
        const LOW_STOCK_THRESHOLD = 15;
        const CRITICAL_THRESHOLD = 5;
        const REORDER_THRESHOLD = 10;

        const stocks = await prisma.stock.findMany({
            where: {
                qty: { gt: 0 }
            },
            select: {
                product_variations_id: true,
                qty: true,
                cost_price: true,
                product_variations: {
                    select: {
                        product_id: true
                    }
                }
            }
        });

        // Group by product_variations_id and sum quantities
        const groupedStock = stocks.reduce((acc, stock) => {
            const pvId = stock.product_variations_id;
            if (!acc[pvId]) {
                acc[pvId] = {
                    product_variations_id: pvId,
                    product_id: stock.product_variations.product_id,
                    totalQty: 0,
                    totalValue: 0
                };
            }
            acc[pvId].totalQty += stock.qty || 0;
            acc[pvId].totalValue += (stock.qty || 0) * (stock.cost_price || 0);
            return acc;
        }, {});

        // Filter for low stock variations
        const lowStockVariations = Object.values(groupedStock)
            .filter(group => group.totalQty > 0 && group.totalQty < LOW_STOCK_THRESHOLD);

        // Calculate statistics
        const uniqueProducts = new Set();
        const productsNeedingReorder = new Set();
        let totalValue = 0;
        let belowThresholdCount = 0;

        lowStockVariations.forEach(group => {
            uniqueProducts.add(group.product_id);
            totalValue += group.totalValue;

            if (group.totalQty <= CRITICAL_THRESHOLD) {
                belowThresholdCount++;
            }

            if (group.totalQty < REORDER_THRESHOLD) {
                productsNeedingReorder.add(group.product_id);
            }
        });

        return {
            low_stock_items_count: lowStockVariations.length,
            total_products_count: uniqueProducts.size,
            potential_loss_value: totalValue,
            below_threshold_count: belowThresholdCount,
            reorder_required_count: productsNeedingReorder.size
        };
    }
}

module.exports = Stock;