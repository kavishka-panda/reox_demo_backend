const { Prisma } = require("@prisma/client");
const prisma = require("../config/prismaClient");

const getPreviousPeriodDates = (fromDate, toDate) => {
    if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        const diffTime = Math.abs(to - from);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const prevTo = new Date(from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - diffDays);

        return {
            fromDate: prevFrom.toISOString().split('T')[0],
            toDate: prevTo.toISOString().split('T')[0]
        };
    }

    if (fromDate) {
        const from = new Date(fromDate);
        const prev = new Date(from);
        prev.setDate(prev.getDate() - 1);
        return {
            fromDate: prev.toISOString().split('T')[0],
            toDate: prev.toISOString().split('T')[0]
        };
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
        fromDate: yesterday.toISOString().split('T')[0],
        toDate: yesterday.toISOString().split('T')[0]
    };
};

const calculatePercentageChange = (current, previous) => {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }
    return parseFloat((((current - previous) / previous) * 100).toFixed(2));
};

const getInventoryCardData = async (fromDate = null, toDate = null) => {
    try {

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Date filters
        const hasDateFilter = fromDate && toDate;

        // ---------- CURRENT PERIOD ----------
        const stockDateCondition = hasDateFilter
            ? Prisma.sql`
                INNER JOIN batch b ON stock.batch_id = b.id
                WHERE b.date_time BETWEEN ${new Date(fromDate)}
                AND ${new Date(toDate)}
            `
            : Prisma.sql`WHERE 1=1`;

        const deadstockDateCondition = hasDateFilter
            ? Prisma.sql`
                INNER JOIN batch b ON stock.batch_id = b.id
                WHERE stock.exp > ${today}
                AND b.date_time BETWEEN ${new Date(fromDate)}
                AND ${new Date(toDate)}
            `
            : Prisma.sql`WHERE stock.exp > ${today}`;

        // Prisma where filter for current period
        const prismaDateFilter = hasDateFilter
            ? {
                created_at: {
                    gte: new Date(fromDate),
                    lte: new Date(toDate),
                },
            }
            : {};

        // ---------- PREVIOUS PERIOD ----------
        const prevDates = getPreviousPeriodDates(fromDate, toDate);
        
        const prevStockDateCondition = hasDateFilter
            ? Prisma.sql`
                INNER JOIN batch b ON stock.batch_id = b.id
                WHERE b.date_time BETWEEN ${new Date(prevDates.fromDate)}
                AND ${new Date(prevDates.toDate)}
            `
            : Prisma.sql`WHERE 1=1`;

        const prevDeadstockDateCondition = hasDateFilter
            ? Prisma.sql`
                INNER JOIN batch b ON stock.batch_id = b.id
                WHERE stock.exp > ${today}
                AND b.date_time BETWEEN ${new Date(prevDates.fromDate)}
                AND ${new Date(prevDates.toDate)}
            `
            : Prisma.sql`WHERE stock.exp > ${today}`;

        const prevPrismaDateFilter = hasDateFilter
            ? {
                created_at: {
                    gte: new Date(prevDates.fromDate),
                    lte: new Date(prevDates.toDate),
                },
            }
            : {};

        // Parallel queries for CURRENT and PREVIOUS periods
        const [
            inventoryValueResult,
            totalProducts,
            lowStockItems,
            deadstockValueResult,
            prevInventoryValueResult,
            prevTotalProducts,
            prevLowStockItems,
            prevDeadstockValueResult,
        ] = await Promise.all([

            // CURRENT PERIOD - Total Inventory Value
            prisma.$queryRaw(
                Prisma.sql`
                    SELECT COALESCE(SUM(qty * rsp), 0) AS total
                    FROM stock
                    ${stockDateCondition}
                `
            ),

            // CURRENT PERIOD - Total Products
            prisma.product_variations.count({
                where: {
                    product_status_id: {
                        not: 3,
                    },
                    ...prismaDateFilter,
                },
            }),

            // CURRENT PERIOD - Low Stock Items
            prisma.stock.count({
                where: {
                    qty: {
                        lt: 10,
                    },
                    product_variations: {
                        product_status_id: {
                            not: 3,
                        },
                    },
                },
            }),

            // CURRENT PERIOD - Deadstock Value
            prisma.$queryRaw(
                Prisma.sql`
                    SELECT COALESCE(SUM(qty * rsp), 0) AS total
                    FROM stock
                    ${deadstockDateCondition}
                `
            ),

            // PREVIOUS PERIOD - Total Inventory Value
            prisma.$queryRaw(
                Prisma.sql`
                    SELECT COALESCE(SUM(qty * rsp), 0) AS total
                    FROM stock
                    ${prevStockDateCondition}
                `
            ),

            // PREVIOUS PERIOD - Total Products
            prisma.product_variations.count({
                where: {
                    product_status_id: {
                        not: 3,
                    },
                    ...prevPrismaDateFilter,
                },
            }),

            // PREVIOUS PERIOD - Low Stock Items
            prisma.stock.count({
                where: {
                    qty: {
                        lt: 10,
                    },
                    product_variations: {
                        product_status_id: {
                            not: 3,
                        },
                    },
                },
            }),

            // PREVIOUS PERIOD - Deadstock Value
            prisma.$queryRaw(
                Prisma.sql`
                    SELECT COALESCE(SUM(qty * rsp), 0) AS total
                    FROM stock
                    ${prevDeadstockDateCondition}
                `
            ),
        ]);

        // Calculate metrics for current period
        const currentMetrics = {
            totalInventoryValue: Number(Number(inventoryValueResult?.[0]?.total || 0).toFixed(2)),
            totalProducts,
            lowStockItems,
            deadstockValue: Number(Number(deadstockValueResult?.[0]?.total || 0).toFixed(2)),
        };

        // Calculate metrics for previous period
        const previousMetrics = {
            totalInventoryValue: Number(Number(prevInventoryValueResult?.[0]?.total || 0).toFixed(2)),
            totalProducts: prevTotalProducts,
            lowStockItems: prevLowStockItems,
            deadstockValue: Number(Number(prevDeadstockValueResult?.[0]?.total || 0).toFixed(2)),
        };

        // Calculate percentage changes
        const percentageChanges = {
            inventoryValueChange: calculatePercentageChange(currentMetrics.totalInventoryValue, previousMetrics.totalInventoryValue),
            productsChange: calculatePercentageChange(currentMetrics.totalProducts, previousMetrics.totalProducts),
            lowStockChange: calculatePercentageChange(currentMetrics.lowStockItems, previousMetrics.lowStockItems),
            deadstockChange: calculatePercentageChange(currentMetrics.deadstockValue, previousMetrics.deadstockValue),
        };

        return {
            ...currentMetrics,
            ...percentageChanges,
            dateRange: hasDateFilter
                ? `${fromDate} to ${toDate}`
                : "Current",
            previousPeriodDateRange: `${prevDates.fromDate} to ${prevDates.toDate}`,
        };

    } catch (error) {
        console.error("Error in getInventoryCardData:", error);
        throw error;
    }
};

/**
 * @param {string | null} fromDate
 * @param {string | null} toDate
 * @param {number} limit
 */
const getTopPerformingProducts = async (
    fromDate = null,
    toDate = null,
    limit = 10
) => {
    try {
        // ---------- date helpers ----------
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build a full UTC range [startOfDay, endOfDay]
        const buildRange = (start, end) => ({
            start: new Date(`${start.toISOString().split('T')[0]}T00:00:00.000Z`),
            end: new Date(`${end.toISOString().split('T')[0]}T23:59:59.999Z`),
        });

        const currentStart = fromDate ? new Date(fromDate) : today;
        const currentEnd = toDate ? new Date(toDate) : today;
        const currentRange = buildRange(currentStart, currentEnd);

        // Previous month: same day numbers, previous month
        const prevStart = new Date(currentStart);
        prevStart.setMonth(prevStart.getMonth() - 1);
        const prevEnd = new Date(currentEnd);
        prevEnd.setMonth(prevEnd.getMonth() - 1);
        const previousRange = buildRange(prevStart, prevEnd);

        // ---------- top products (current period) ----------
        const topProductsRaw = await prisma.$queryRaw`
            WITH product_variation_sales AS (
                SELECT
                    p.id AS product_id,
                    p.product_name,
                    p.category_id,
                    pv.id AS variation_id,
                    CONCAT_WS(', ', NULLIF(pv.color, ''), NULLIF(pv.size, ''), NULLIF(pv.storage_capacity, '')) AS variation_name,
                    SUM(ii.qty) AS variation_units,
                    SUM(ii.qty * ii.current_price) AS variation_amount,
                    SUM(ii.qty * COALESCE(s.cost_price, 0)) AS variation_total_cost,
                    -- Weighted average cost price for the variation
                    CASE WHEN SUM(ii.qty) > 0 
                         THEN SUM(ii.qty * COALESCE(s.cost_price, 0)) / SUM(ii.qty)
                         ELSE 0 
                    END AS avg_cost_price,
                    SUM(ii.qty * (ii.current_price - COALESCE(s.cost_price, 0))) AS variation_margin,
                    ROW_NUMBER() OVER (
                        PARTITION BY p.id
                        ORDER BY SUM(ii.qty) DESC
                    ) AS rn
                FROM invoice_items ii
                INNER JOIN stock s ON ii.stock_id = s.id
                INNER JOIN product_variations pv ON s.product_variations_id = pv.id
                INNER JOIN product p ON pv.product_id = p.id
                INNER JOIN invoice i ON ii.invoice_id = i.id
                WHERE i.created_at BETWEEN ${currentRange.start} AND ${currentRange.end}
                GROUP BY p.id, p.product_name, p.category_id, pv.id, pv.color, pv.size, pv.storage_capacity
            ),
            product_totals AS (
                SELECT
                    product_id,
                    product_name,
                    category_id,
                    SUM(variation_units) AS total_units,
                    SUM(variation_amount) AS total_amount,
                    SUM(variation_margin) AS total_margin,
                    MAX(CASE WHEN rn = 1 THEN variation_name END) AS top_variation_name,
                    MAX(CASE WHEN rn = 1 THEN avg_cost_price END) AS top_variation_cost_price
                FROM product_variation_sales
                GROUP BY product_id, product_name, category_id
            )
            SELECT *
            FROM product_totals
            ORDER BY total_units DESC
            LIMIT ${limit}
        `;

        if (!topProductsRaw.length) return [];

        // ---------- previous month data for the selected products only ----------
        const productIds = topProductsRaw.map(p => p.product_id);

        const previousData = await prisma.$queryRaw`
            SELECT
                p.id,
                SUM(ii.qty) AS sold_units
            FROM invoice_items ii
            INNER JOIN stock s ON ii.stock_id = s.id
            INNER JOIN product_variations pv ON s.product_variations_id = pv.id
            INNER JOIN product p ON pv.product_id = p.id
            INNER JOIN invoice i ON ii.invoice_id = i.id
            WHERE i.created_at BETWEEN ${previousRange.start} AND ${previousRange.end}
              AND p.id IN (${Prisma.join(productIds)})
            GROUP BY p.id
        `;

        const prevMap = new Map();
        previousData.forEach(row => prevMap.set(row.id, Number(row.sold_units)));

        // ---------- format output ----------
        const formatted = topProductsRaw.map(product => {
            const prevUnits = prevMap.get(product.product_id) || 0;
            const totalUnits = Number(product.total_units);
            const totalAmount = Number(product.total_amount);
            const totalMargin = Number(product.total_margin);

            const percentageChange = prevUnits === 0
                ? 100
                : Number((((totalUnits - prevUnits) / prevUnits) * 100).toFixed(2));

            return {
                productId: product.product_id,
                productName: product.product_name,
                categoryId: product.category_id,
                topVariationName: product.top_variation_name,
                topVariationCostPrice: parseFloat(Number(product.top_variation_cost_price).toFixed(2)),
                soldUnits: totalUnits,
                salesAmount: parseFloat(totalAmount.toFixed(2)),
                tradeMargin: parseFloat(totalMargin.toFixed(2)),
                tradeMarginPercentage: totalAmount > 0
                    ? parseFloat(((totalMargin / totalAmount) * 100).toFixed(2))
                    : 0,
                percentageChangeFromLastMonth: percentageChange,
                dateRange: fromDate && toDate
                    ? `${fromDate} to ${toDate}`
                    : today.toISOString().split('T')[0],
            };
        });

        return formatted;
    } catch (error) {
        console.error("Error in getTopPerformingProducts:", error);
        throw error;
    }
};

/**
 * @param {string | null} fromDate
 * @param {string | null} toDate
 * @param {number} limit
 */
const getSlowMovingProducts = async (
    fromDate = null,
    toDate = null,
    limit = 5
) => {
    try {
        // ---------- date helpers ----------
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build a full UTC range [startOfDay, endOfDay]
        const buildRange = (start, end) => ({
            start: new Date(`${start.toISOString().split('T')[0]}T00:00:00.000Z`),
            end: new Date(`${end.toISOString().split('T')[0]}T23:59:59.999Z`),
        });

        const currentStart = fromDate ? new Date(fromDate) : today;
        const currentEnd = toDate ? new Date(toDate) : today;
        const currentRange = buildRange(currentStart, currentEnd);

        // ---------- slow moving products (longest time without sale) ----------
        const slowMovingRaw = await prisma.$queryRaw`
            WITH all_products AS (
                SELECT DISTINCT p.id, p.product_name, p.category_id
                FROM product p
                INNER JOIN product_variations pv ON pv.product_id = p.id
                INNER JOIN stock s ON s.product_variations_id = pv.id
                WHERE s.qty > 0 AND pv.product_status_id != 3
            ),
            product_last_sale AS (
                SELECT
                    ap.id AS product_id,
                    ap.product_name,
                    ap.category_id,
                    MAX(i.created_at) AS last_sale_date,
                    CASE 
                        WHEN MAX(i.created_at) IS NULL THEN 999999
                        ELSE COALESCE(DATEDIFF(${today}, MAX(i.created_at)), 999999)
                    END AS days_since_last_sale
                FROM all_products ap
                LEFT JOIN product_variations pv ON pv.product_id = ap.id
                LEFT JOIN stock s ON s.product_variations_id = pv.id
                LEFT JOIN invoice_items ii ON ii.stock_id = s.id
                LEFT JOIN invoice i ON i.id = ii.invoice_id AND i.created_at <= ${currentRange.end}
                GROUP BY ap.id, ap.product_name, ap.category_id
            ),
            current_stock AS (
                SELECT
                    pv.product_id,
                    SUM(s.qty) AS total_qty,
                    SUM(s.qty * s.rsp) AS total_value
                FROM stock s
                INNER JOIN product_variations pv ON s.product_variations_id = pv.id
                WHERE s.qty > 0
                GROUP BY pv.product_id
            )
            SELECT
                pls.product_id,
                pls.product_name,
                pls.category_id,
                pls.last_sale_date,
                pls.days_since_last_sale,
                COALESCE(cs.total_qty, 0) AS current_stock_qty,
                COALESCE(cs.total_value, 0) AS total_stock_value
            FROM product_last_sale pls
            LEFT JOIN current_stock cs ON pls.product_id = cs.product_id
            ORDER BY pls.days_since_last_sale DESC
            LIMIT ${limit}
        `;

        if (!slowMovingRaw.length) return [];

        // ---------- format output ----------
        const formatted = slowMovingRaw.map(product => {
            const totalQty = Number(product.current_stock_qty);
            const totalValue = Number(product.total_stock_value);
            const daysSinceLastSale = Number(product.days_since_last_sale);

            return {
                productId: product.product_id,
                productName: product.product_name,
                categoryId: product.category_id,
                lastSaleDate: product.last_sale_date
                    ? new Date(product.last_sale_date).toISOString().split('T')[0]
                    : null,
                daysSinceLastSale: daysSinceLastSale === 999999 ? "N/A" : daysSinceLastSale,
                currentStockQty: totalQty,
                stockValue: parseFloat(totalValue.toFixed(2)),
                averageMRP: totalQty > 0
                    ? parseFloat((totalValue / totalQty).toFixed(2))
                    : 0,
            };
        });

        return formatted;
    } catch (error) {
        console.error("Error in getSlowMovingProducts:", error);
        throw error;
    }
};

/**
 * Get Critical Reorder List - products with low or out of stock
 */
const getCriticalReorderList = async () => {
    try {
        const criticalProductsRaw = await prisma.$queryRaw`
            WITH stock_summary AS (
                SELECT
                    p.id AS product_id,
                    p.product_name,
                    p.category_id,
                    pv.id AS variation_id,
                    CONCAT_WS(', ', NULLIF(pv.color, ''), NULLIF(pv.size, ''), NULLIF(pv.storage_capacity, '')) AS variation_name,
                    s.qty,
                    s.rsp,
                    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY s.qty ASC, s.id ASC) AS qty_rank
                FROM product p
                INNER JOIN product_variations pv ON p.id = pv.product_id
                INNER JOIN stock s ON pv.id = s.product_variations_id
                WHERE pv.product_status_id != 3
                  AND s.qty < 10
            ),
            last_supplier_per_product AS (
                SELECT
                    pv.product_id,
                    MAX(g.id) AS latest_grn_id
                FROM product_variations pv
                INNER JOIN stock s ON pv.id = s.product_variations_id
                INNER JOIN grn_items gi ON s.id = gi.stock_id
                INNER JOIN grn g ON gi.grn_id = g.id
                WHERE pv.product_status_id != 3
                GROUP BY pv.product_id
            ),
            supplier_info AS (
                SELECT
                    lsp.product_id,
                    sup.supplier_name,
                    sup.contact_number
                FROM last_supplier_per_product lsp
                INNER JOIN grn g ON lsp.latest_grn_id = g.id
                INNER JOIN supplier sup ON g.supplier_id = sup.id
            )
            SELECT
                ss.product_id,
                ss.product_name,
                ss.category_id,
                ss.variation_name,
                ss.qty,
                ss.rsp,
                CASE 
                    WHEN ss.qty = 0 THEN 'Out of Stock'
                    WHEN ss.qty < 10 THEN 'Low Stock'
                END AS alert_level,
                COALESCE(si.supplier_name, 'N/A') AS last_supplier,
                COALESCE(si.contact_number, 'N/A') AS supplier_contact
            FROM stock_summary ss
            LEFT JOIN supplier_info si ON ss.product_id = si.product_id
            WHERE ss.qty_rank = 1
            ORDER BY ss.qty ASC, ss.product_name ASC
        `;

        if (!criticalProductsRaw.length) return [];

        // Format output
        const formatted = criticalProductsRaw.map(item => ({
            productId: item.product_id,
            productName: item.product_name,
            categoryId: item.category_id,
            variationName: item.variation_name || 'Standard',
            currentQty: Number(item.qty),
            mrp: parseFloat(Number(item.rsp).toFixed(2)),
            alertLevel: item.alert_level,
            lastSupplier: item.last_supplier,
            supplierContact: item.supplier_contact,
        }));

        return formatted;
    } catch (error) {
        console.error("Error in getCriticalReorderList:", error);
        throw error;
    }
};

/**
 * Get Product Profitability Analysis
 * Analyzes profit margins aggregated per product variation
 * @param {number} limit - Records per page (default: 10)
 * @param {number} offset - Pagination offset (default: 0)
 */
const getProductProfitabilityAnalysis = async (limit = 10, offset = 0) => {
    try {
        const limitValue = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
        const offsetValue = Math.max(parseInt(offset) || 0, 0);

        // Get total count of variations with valid pricing
        const countResult = await prisma.$queryRaw`
            SELECT COUNT(DISTINCT pv.id) AS total
            FROM product p
            INNER JOIN product_variations pv ON p.id = pv.product_id
            INNER JOIN stock s ON pv.id = s.product_variations_id
            WHERE pv.product_status_id != 3
              AND s.cost_price > 0
              AND s.rsp > 0
        `;

        const totalRecords = Number(countResult[0]?.total || 0);

        // Get profitability data aggregated per variation (weighted average cost, total qty)
        const profitabilityRaw = await prisma.$queryRaw`
            SELECT
                p.id AS product_id,
                p.product_name,
                p.category_id,
                pv.id AS variation_id,
                CONCAT_WS(', ', NULLIF(pv.color, ''), NULLIF(pv.size, ''), NULLIF(pv.storage_capacity, '')) AS variation_name,
                CASE WHEN SUM(s.qty) > 0 THEN SUM(s.qty * s.cost_price) / SUM(s.qty) ELSE 0 END AS weighted_avg_cost,
                MAX(s.rsp) AS selling_price,
                SUM(s.qty) AS total_qty,
                COUNT(s.id) AS batch_count
            FROM product p
            INNER JOIN product_variations pv ON p.id = pv.product_id
            INNER JOIN stock s ON pv.id = s.product_variations_id
            WHERE pv.product_status_id != 3
              AND s.cost_price > 0
              AND s.rsp > 0
            GROUP BY pv.id, p.id, p.product_name, p.category_id, pv.color, pv.size, pv.storage_capacity
            ORDER BY p.product_name ASC
            LIMIT ${limitValue} OFFSET ${offsetValue}
        `;

        if (!profitabilityRaw.length) {
            return {
                data: [],
                pagination: {
                    total: totalRecords,
                    limit: limitValue,
                    offset: offsetValue,
                    page: Math.floor(offsetValue / limitValue) + 1,
                    totalPages: Math.ceil(totalRecords / limitValue),
                },
            };
        }

        const formatted = profitabilityRaw.map(item => {
            const unitCost = Number(item.weighted_avg_cost);
            const sellingPrice = Number(item.selling_price);
            
            // Calculate profit metrics
            const profit = sellingPrice - unitCost;
            const markupPercentage = unitCost > 0 
                ? parseFloat(((profit / unitCost) * 100).toFixed(2))
                : 0;
            const gpPercentage = sellingPrice > 0
                ? parseFloat(((profit / sellingPrice) * 100).toFixed(2))
                : 0;

            // Determine status based on profit margin
            let status = 'Healthy';
            if (gpPercentage < 10) {
                status = 'Critical Margin';
            } else if (gpPercentage < 20) {
                status = 'Low Margin';
            }

            return {
                productId: item.product_id,
                productName: item.product_name,
                categoryId: item.category_id,
                variationName: item.variation_name || 'Standard',
                unitCost: parseFloat(unitCost.toFixed(2)),
                sellingPrice: parseFloat(sellingPrice.toFixed(2)),
                markupPercentage: markupPercentage,
                gpPercentage: gpPercentage,
                profit: parseFloat(profit.toFixed(2)),
                status: status,
                totalQty: Number(item.total_qty),
                batchCount: Number(item.batch_count),
            };
        });

        return {
            data: formatted,
            pagination: {
                total: totalRecords,
                limit: limitValue,
                offset: offsetValue,
                page: Math.floor(offsetValue / limitValue) + 1,
                totalPages: Math.ceil(totalRecords / limitValue),
            },
        };
    } catch (error) {
        console.error("Error in getProductProfitabilityAnalysis:", error);
        throw error;
    }
};

module.exports = {
    getInventoryCardData,
    getTopPerformingProducts,
    getSlowMovingProducts,
    getCriticalReorderList,
    getProductProfitabilityAnalysis,
};