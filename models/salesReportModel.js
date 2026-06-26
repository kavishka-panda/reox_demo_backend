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
        prevFrom.setDate(prevFrom.getDate() - diffDays); // diffDays already correct for length

        return {
            fromDate: prevFrom.toISOString().split('T')[0],
            toDate: prevTo.toISOString().split('T')[0]
        };
    }

    // ---------- Single date: 1-day comparison ----------
    if (fromDate) {
        const from = new Date(fromDate);
        const prev = new Date(from);
        prev.setDate(prev.getDate() - 1);          // day before
        return {
            fromDate: prev.toISOString().split('T')[0],
            toDate: prev.toISOString().split('T')[0]   // same day → 1-day range
        };
    }

    // ---------- No dates (today): compare today vs yesterday ----------
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
        fromDate: yesterday.toISOString().split('T')[0],
        toDate: yesterday.toISOString().split('T')[0]  // just yesterday
    };
};

// Helper: Get previous month date with month boundary handling
const getPreviousMonthDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const prevMonth = m - 1;
    const lastDay = new Date(Date.UTC(y, prevMonth + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${y}-${String(prevMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
};

// Helper: Build WHERE clause and calculate metrics
const calculateMetrics = (invoices) => {
    if (invoices.length === 0) {
        return {
            grossSales: 0,
            totalDiscounts: 0,
            totalReturns: 0,
            netRevenue: 0,
            totalExpenses: 0,
            netProfit: 0,
            invoiceCount: 0,
        };
    }

    let grossSales = 0;
    let totalDiscounts = 0;
    let totalReturns = 0;
    let totalExpenses = 0;
    let netProfit = 0;

    for (const invoice of invoices) {
        const invoiceDiscount = invoice.discount || 0;
        let invoiceProfit = 0;

        for (const item of invoice.invoice_items) {
            const price = item.current_price || 0;
            const qty = item.qty || 0;
            const returnedQty = item.returned_qty || 0;
            const effectiveQty = qty - returnedQty;
            const cost = item.stock?.cost_price || 0;

            const discountPerUnit =
                (item.discount_percentage || 0) > 0
                    ? (price * item.discount_percentage) / 100
                    : (item.discount_amount || 0);

            grossSales += price * qty;
            totalDiscounts += discountPerUnit * qty;

            if (returnedQty > 0) {
                totalReturns += (price - discountPerUnit) * returnedQty;
            }

            totalExpenses += cost * effectiveQty;

            const itemProfit =
                (price - cost) * effectiveQty - discountPerUnit * effectiveQty;
            invoiceProfit += itemProfit;
        }

        totalDiscounts += invoiceDiscount;
        netProfit += invoiceProfit - invoiceDiscount;
    }

    const netRevenue = grossSales - totalDiscounts - totalReturns;

    return {
        grossSales: parseFloat(grossSales.toFixed(2)),
        totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
        totalReturns: parseFloat(totalReturns.toFixed(2)),
        netRevenue: parseFloat(netRevenue.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        invoiceCount: invoices.length,
    };
};

// Helper: Calculate percentage change
const calculatePercentageChange = (current, previous) => {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }
    return parseFloat((((current - previous) / previous) * 100).toFixed(2));
};

// Helper: Aggregate daily net amounts from invoices
const aggregateDailyNetAmounts = (invoices) => {
    const dailyMap = new Map();
    
    for (const invoice of invoices) {
        const dayKey = invoice.created_at.toISOString().slice(0, 10);
        
        if (!dailyMap.has(dayKey)) {
            dailyMap.set(dayKey, {
                grossAmount: 0,
                discount: 0,
                refunded: 0,
            });
        }
        
        const dayData = dailyMap.get(dayKey);
        let grossAmount = 0;
        let discount = invoice.discount || 0;
        let refunded = 0;
        
        for (const item of invoice.invoice_items) {
            const price = item.current_price || 0;
            const qty = item.qty || 0;
            const returnedQty = item.returned_qty || 0;
            
            const discountPerUnit =
                (item.discount_percentage || 0) > 0
                    ? (price * item.discount_percentage) / 100
                    : (item.discount_amount || 0);
            
            grossAmount += price * qty;
            discount += discountPerUnit * qty;
            
            if (returnedQty > 0) {
                refunded += (price - discountPerUnit) * returnedQty;
            }
        }
        
        dayData.grossAmount += grossAmount;
        dayData.discount += discount;
        dayData.refunded += refunded;
    }
    
    // Calculate netAmount for each day
    for (const dayData of dailyMap.values()) {
        dayData.netAmount = parseFloat((dayData.grossAmount - dayData.discount - dayData.refunded).toFixed(2));
    }
    
    return dailyMap;
};

const getSalesCardData = async (fromDate = null, toDate = null) => {
    try {
        // ---------- 1. Build UTC date range for CURRENT period ----------
        const currentWhere = {};
        const makeUTCRange = (dateStr) => ({
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
        });

        if (fromDate && toDate) {
            currentWhere.created_at = {
                gte: new Date(`${fromDate}T00:00:00.000Z`),
                lte: new Date(`${toDate}T23:59:59.999Z`),
            };
        } else if (fromDate) {
            currentWhere.created_at = makeUTCRange(fromDate);
        } else {
            const today = new Date().toISOString().split('T')[0];
            currentWhere.created_at = makeUTCRange(today);
        }

        // ---------- 2. Build date range for PREVIOUS period ----------
        const prevDates = getPreviousPeriodDates(fromDate, toDate);
        const previousWhere = {
            created_at: {
                gte: new Date(`${prevDates.fromDate}T00:00:00.000Z`),
                lte: new Date(`${prevDates.toDate}T23:59:59.999Z`),
            }
        };

        // ---------- 3. Fetch invoices for both periods in parallel ----------
        const [currentInvoices, previousInvoices] = await Promise.all([
            prisma.invoice.findMany({
                where: currentWhere,
                select: {
                    discount: true,
                    invoice_items: {
                        select: {
                            current_price: true,
                            qty: true,
                            returned_qty: true,
                            discount_percentage: true,
                            discount_amount: true,
                            stock: {
                                select: { cost_price: true },
                            },
                        },
                    },
                },
            }),
            prisma.invoice.findMany({
                where: previousWhere,
                select: {
                    discount: true,
                    invoice_items: {
                        select: {
                            current_price: true,
                            qty: true,
                            returned_qty: true,
                            discount_percentage: true,
                            discount_amount: true,
                            stock: {
                                select: { cost_price: true },
                            },
                        },
                    },
                },
            })
        ]);

        // ---------- 4. Calculate metrics for both periods ----------
        const currentMetrics = calculateMetrics(currentInvoices);
        const previousMetrics = calculateMetrics(previousInvoices);

        // ---------- 5. Calculate percentage changes ----------
        const percentageChanges = {
            grossSalesChange: calculatePercentageChange(currentMetrics.grossSales, previousMetrics.grossSales),
            netRevenueChange: calculatePercentageChange(currentMetrics.netRevenue, previousMetrics.netRevenue),
            netProfitChange: calculatePercentageChange(currentMetrics.netProfit, previousMetrics.netProfit),
            invoiceCountChange: calculatePercentageChange(currentMetrics.invoiceCount, previousMetrics.invoiceCount),
        };

        // ---------- 6. Format & return ----------
        return {
            ...currentMetrics,
            ...percentageChanges,
            dateRange: fromDate && toDate
                ? `${fromDate} to ${toDate}`
                : fromDate || 'Today',
            previousPeriodDateRange: `${prevDates.fromDate} to ${prevDates.toDate}`,
        };
    } catch (error) {
        console.error("Error in getSalesCardData:", error);
        throw error;
    }
};

const getTransactionLedger = async (fromDate = null, toDate = null, page = null, limit = null) => {
    try {
        // ---------- 1. Build UTC date range ----------
        const where = {};
        const makeUTCRange = (dateStr) => ({
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
        });

        if (fromDate && toDate) {
            where.created_at = {
                gte: new Date(`${fromDate}T00:00:00.000Z`),
                lte: new Date(`${toDate}T23:59:59.999Z`),
            };
        } else if (fromDate) {
            where.created_at = makeUTCRange(fromDate);
        } else {
            const today = new Date().toISOString().split('T')[0];
            where.created_at = makeUTCRange(today);
        }

        // ---------- 2. Fetch only needed fields ----------
        const invoices = await prisma.invoice.findMany({
            where,
            select: {
                created_at: true,
                discount: true,                     // invoice-level discount
                invoice_items: {
                    select: {
                        current_price: true,
                        qty: true,
                        returned_qty: true,
                        discount_percentage: true,
                        discount_amount: true,
                        stock: {
                            select: { cost_price: true },
                        },
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        // ---------- 3. Early exit ----------
        if (invoices.length === 0) {
            return {
                data: [],  // Empty array - no records need previousMonthNetAmount field
                pagination: { totalRecords: 0, returned: 0, allDataReturned: true },
            };
        }

        // ---------- 4. Aggregate by day in a single pass ----------
        const dayMap = new Map();

        for (const invoice of invoices) {
            const dayKey = invoice.created_at.toISOString().slice(0, 10);
            let day = dayMap.get(dayKey);

            if (!day) {
                day = {
                    date: dayKey,
                    invoiceCount: 0,
                    grossAmount: 0,
                    discount: 0,
                    refunded: 0,
                    profit: 0,          // will be netAmount - expenses
                    totalExpenses: 0,
                };
                dayMap.set(dayKey, day);
            }

            day.invoiceCount += 1;
            let grossAmount = 0;
            let discount = invoice.discount || 0;        // start with invoice-level discount
            let refunded = 0;
            let itemProfitTotal = 0;
            let expenses = 0;

            // Single loop over invoice items – compute everything at once
            for (const item of invoice.invoice_items) {
                const price = item.current_price || 0;
                const qty = item.qty || 0;
                const returnedQty = item.returned_qty || 0;
                const effectiveQty = qty - returnedQty;
                const cost = item.stock?.cost_price || 0;

                // Per-unit discount (business rule: discount_amount is per unit)
                const discountPerUnit =
                    (item.discount_percentage || 0) > 0
                        ? (price * item.discount_percentage) / 100
                        : (item.discount_amount || 0);

                // 1. Gross sales (before any discount or returns)
                grossAmount += price * qty;

                // 2. Total discounts (invoice level accumulated, item level added)
                discount += discountPerUnit * qty;

                // 3. Refunded amount (customer gets back price - per-unit discount)
                if (returnedQty > 0) {
                    refunded += (price - discountPerUnit) * returnedQty;
                }

                // 4. Profit contribution from this item after returns and item discount
                itemProfitTotal += (price - cost) * effectiveQty - discountPerUnit * effectiveQty;

                // 5. COGS (expenses)
                expenses += cost * effectiveQty;
            }

            // Final profit = sum of item contributions minus invoice-level discount
            const profit = itemProfitTotal - (invoice.discount || 0);

            // Add to day totals
            day.grossAmount += grossAmount;
            day.discount += discount;
            day.refunded += refunded;
            day.profit += profit;
            day.totalExpenses += expenses;
        }

        // ---------- 5. Convert map to sorted array ----------
        let ledgerData = Array.from(dayMap.values())
            .map(day => ({
                date: day.date,
                invoiceCount: day.invoiceCount,
                grossAmount: parseFloat(day.grossAmount.toFixed(2)),
                discount: parseFloat(day.discount.toFixed(2)),
                refunded: parseFloat(day.refunded.toFixed(2)),
                netAmount: parseFloat((day.grossAmount - day.discount - day.refunded).toFixed(2)),
                expenses: parseFloat(day.totalExpenses.toFixed(2)),
                profit: parseFloat(day.profit.toFixed(2)),
            }))
            .sort((a, b) => b.date.localeCompare(a.date));

        // ---------- 5.5. Fetch previous month data for same calendar dates ----------
        const previousMonthNetMap = new Map();
        
        // Calculate the same dates in the previous month using month boundary-aware function
        const previousMonthDates = ledgerData.map(day => getPreviousMonthDate(day.date));

        // Remove duplicates and sort to get true min/max dates
        const sortedDates = [...new Set(previousMonthDates)].sort();

        if (sortedDates.length > 0) {
            // Fetch invoices for all previous month dates in one query
            const prevMonthInvoices = await prisma.invoice.findMany({
                where: {
                    created_at: {
                        gte: new Date(`${sortedDates[0]}T00:00:00.000Z`),
                        lte: new Date(`${sortedDates[sortedDates.length - 1]}T23:59:59.999Z`),
                    }
                },
                select: {
                    created_at: true,
                    discount: true,
                    invoice_items: {
                        select: {
                            current_price: true,
                            qty: true,
                            returned_qty: true,
                            discount_percentage: true,
                            discount_amount: true,
                            stock: {
                                select: { cost_price: true },
                            },
                        },
                    },
                },
            });

            // Aggregate previous month data by day using the same shared logic
            const aggregatedPrevMonth = aggregateDailyNetAmounts(prevMonthInvoices);
            
            // Populate previousMonthNetMap from aggregated data
            for (const [dateKey, dayData] of aggregatedPrevMonth.entries()) {
                previousMonthNetMap.set(dateKey, dayData);
            }
        }

        // Add previous month net amount to each record
        ledgerData = ledgerData.map(day => {
            const currentDate = new Date(day.date);
            const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate());
            const prevMonthDateStr = previousMonthDate.toISOString().split('T')[0];
            
            return {
                ...day,
                previousMonthNetAmount: previousMonthNetMap.has(prevMonthDateStr) 
                    ? previousMonthNetMap.get(prevMonthDateStr).netAmount 
                    : 0
            };
        });

        // ---------- 6. Pagination ----------
        let paginationInfo;
        let pageData = ledgerData;

        if (page != null || limit != null) {
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
            const totalPages = Math.ceil(ledgerData.length / limitNum);
            const skip = (pageNum - 1) * limitNum;

            pageData = ledgerData.slice(skip, skip + limitNum);

            paginationInfo = {
                currentPage: pageNum,
                pageSize: limitNum,
                totalRecords: ledgerData.length,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
            };
        } else {
            paginationInfo = {
                totalRecords: ledgerData.length,
                returned: ledgerData.length,
                allDataReturned: true,
            };
        }

        return { data: pageData, pagination: paginationInfo };
    } catch (error) {
        console.error("Error in getTransactionLedger:", error);
        throw error;
    }
};

const getZReportData = async (fromDate = null, toDate = null, counter_id = null) => {
    try {
        // ---------- 1. Build date range ----------
        const where = {};
        
        if (fromDate && toDate) {
            where.opening_date_time = {
                gte: new Date(`${fromDate}T00:00:00.000Z`),
                lte: new Date(`${toDate}T23:59:59.999Z`)
            };
        } else if (fromDate) {
            where.opening_date_time = {
                gte: new Date(`${fromDate}T00:00:00.000Z`),
                lt: new Date(new Date(`${fromDate}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
            };
        } else {
            const today = new Date().toISOString().split('T')[0];
            where.opening_date_time = {
                gte: new Date(`${today}T00:00:00.000Z`),
                lt: new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
            };
        }

        // ---------- 1.5. Filter by counter if provided ----------
        if (counter_id) {
            where.cashier_counters_id = parseInt(counter_id, 10);
        }

        // ---------- 2. Fetch only needed fields ----------
        const sessions = await prisma.cash_sessions.findMany({
            where,
            select: {
                opening_balance: true,
                cash_total: true,
                card_total: true,
                bank_total: true,
                money_exchange: {
                    select: {
                        amount: true,
                        exchange_type: {
                            select: { id: true }   // only need id to distinguish cash in/out
                        }
                    }
                }
            },
            orderBy: { opening_date_time: 'asc' }
        });

        // ---------- 3. Early exit ----------
        if (sessions.length === 0) {
            return {
                summary: {
                    openingFloat: 0,
                    cashSales: 0,
                    cardPayments: 0,
                    digitalBank: 0,
                    cashIn: 0,
                    cashOut: 0,
                    totalExpectedTaking: 0
                },
                sessionCount: 0,
                dateRange: fromDate && toDate
                    ? `${fromDate} to ${toDate}`
                    : fromDate || 'Today'
            };
        }

        // ---------- 4. Single-pass aggregation ----------
        let totalOpeningFloat = 0;
        let totalCashSales = 0;
        let totalCardPayments = 0;
        let totalDigitalBank = 0;
        let totalCashIn = 0;
        let totalCashOut = 0;

        for (const session of sessions) {
            // Parse main fields once
            const openingBalance = parseFloat(session.opening_balance) || 0;
            const cashTotal = parseFloat(session.cash_total) || 0;
            const cardTotal = parseFloat(session.card_total) || 0;
            const bankTotal = parseFloat(session.bank_total) || 0;

            totalOpeningFloat += openingBalance;
            totalCashSales += cashTotal;
            totalCardPayments += cardTotal;
            totalDigitalBank += bankTotal;

            // Money exchanges: group by type_id (1 = cash in, 2 = cash out)
            for (const exchange of session.money_exchange) {
                const amount = parseFloat(exchange.amount) || 0;
                const typeId = exchange.exchange_type.id;   // assuming id 1 and 2

                if (typeId === 1) {
                    totalCashIn += amount;
                } else if (typeId === 2) {
                    totalCashOut += amount;
                }
            }
        }

        const totalExpectedTaking = (totalOpeningFloat + totalCashSales + totalCashIn) - totalCashOut;

        return {
            summary: {
                openingFloat: parseFloat(totalOpeningFloat.toFixed(2)),
                cashSales: parseFloat(totalCashSales.toFixed(2)),
                cardPayments: parseFloat(totalCardPayments.toFixed(2)),
                digitalBank: parseFloat(totalDigitalBank.toFixed(2)),
                cashIn: parseFloat(totalCashIn.toFixed(2)),
                cashOut: parseFloat(totalCashOut.toFixed(2)),
                totalExpectedTaking: parseFloat(totalExpectedTaking.toFixed(2))
            },
            sessionCount: sessions.length,
            dateRange: fromDate && toDate
                ? `${fromDate} to ${toDate}`
                : fromDate || 'Today'
        };
    } catch (error) {
        console.error('Error in getZReportData:', error);
        throw error;
    }
};

const getTodaysSalesTrend = async () => {
    try {
        // 1. Determine current bucket index (0‑11) based on current server hour
        const currentHour = new Date().getHours();
        const currentBucket = Math.floor(currentHour / 2); // e.g. 15 → bucket 7
        const startBucket = Math.max(0, currentBucket - 6); // at most 7 buckets
        const endBucket = currentBucket;

        // 2. Raw SQL – only fetch buckets from startBucket to endBucket
        const rows = await prisma.$queryRawUnsafe(`
            SELECT
                FLOOR(HOUR(created_at) / 2) AS bucket,
                COALESCE(SUM(sub_total - refunded_amount), 0) AS netAmount,
                COUNT(*) AS invoiceCount
            FROM invoice
            WHERE DATE(created_at) = CURDATE()
                AND FLOOR(HOUR(created_at) / 2) BETWEEN ${startBucket} AND ${endBucket}
            GROUP BY bucket
            ORDER BY bucket
        `);

        // 3. Build only the needed period slots (from startBucket to endBucket)
        const periodCount = endBucket - startBucket + 1;
        const periods = Array.from({ length: periodCount }, (_, i) => {
            const bucketIdx = startBucket + i;
            const startHour = bucketIdx * 2;
            const endHour = (bucketIdx + 1) * 2;
            return {
                period: `${String(startHour).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00`,
                netAmount: 0,
                invoiceCount: 0,
            };
        });

        // 4. Fill in actual data from the query result
        for (const row of rows) {
            const idx = Number(row.bucket) - startBucket; // map absolute bucket to local index
            if (idx >= 0 && idx < periodCount) {
                periods[idx].netAmount = Number(row.netAmount) || 0;
                periods[idx].invoiceCount = Number(row.invoiceCount) || 0;
            }
        }

        // 5. Totals (only for the returned periods)
        const totalNet = periods.reduce((s, p) => s + p.netAmount, 0);
        const totalInvoices = periods.reduce((s, p) => s + p.invoiceCount, 0);
        const todayStr = new Date().toISOString().split('T')[0];

        return {
            date: todayStr,
            data: periods.map(p => ({
                period: p.period,
                netAmount: parseFloat(p.netAmount.toFixed(2)),
                invoiceCount: p.invoiceCount,
            })),
            totalNetAmount: parseFloat(totalNet.toFixed(2)),
            totalInvoices,
        };
    } catch (error) {
        console.error('Error in getTodaysSalesTrend:', error);
        throw error;
    }
};

const getRecentSessionsHistory = async () => {
    try {
        // ---------- 1. Calculate date range for last 3 days ----------
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2); // 2 days back to include today and 2 previous days
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // ---------- 2. Fetch all sessions for last 3 days with user info ----------
        const sessions = await prisma.cash_sessions.findMany({
            where: {
                opening_date_time: {
                    gte: threeDaysAgo,
                    lt: tomorrow
                }
            },
            select: {
                opening_date_time: true,
                opening_balance: true,
                cash_total: true,
                card_total: true,
                bank_total: true,
                user: {
                    select: {
                        name: true
                    }
                },
                money_exchange: {
                    select: {
                        amount: true,
                        exchange_type: {
                            select: { id: true }
                        }
                    }
                }
            },
            orderBy: { opening_date_time: 'desc' }
        });

        // ---------- 3. Early exit if no sessions ----------
        if (sessions.length === 0) {
            return {
                data: []
            };
        }

        // ---------- 4. Group by date and aggregate ----------
        const dayMap = new Map();

        for (const session of sessions) {
            const dateKey = session.opening_date_time.toISOString().split('T')[0];

            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, {
                    date: dateKey,
                    openingFloat: 0,
                    cashSales: 0,
                    cardPayments: 0,
                    digitalBank: 0,
                    cashIn: 0,
                    cashOut: 0,
                    cashierName: session.user?.name || 'N/A',
                    openingTime: session.opening_date_time
                });
            }

            const day = dayMap.get(dateKey);
            day.openingFloat += parseFloat(session.opening_balance) || 0;
            day.cashSales += parseFloat(session.cash_total) || 0;
            day.cardPayments += parseFloat(session.card_total) || 0;
            day.digitalBank += parseFloat(session.bank_total) || 0;

            // Separate cash in/out
            for (const exchange of session.money_exchange) {
                const amount = parseFloat(exchange.amount) || 0;
                if (exchange.exchange_type.id === 1) {
                    day.cashIn += amount;
                } else if (exchange.exchange_type.id === 2) {
                    day.cashOut += amount;
                }
            }
        }

        // ---------- 5. Format results with totalExpectedTaking calculation ----------
        const results = Array.from(dayMap.values())
            .map(day => {
                const totalExpectedTaking = (day.openingFloat + day.cashSales + day.cashIn) - day.cashOut;
                return {
                    date: day.date,
                    totalExpectedTaking: parseFloat(totalExpectedTaking.toFixed(2)),
                    cashierName: day.cashierName,
                    openingTime: day.openingTime.toISOString()
                };
            })
            .sort((a, b) => b.date.localeCompare(a.date)); // newest first

        return {
            data: results
        };
    } catch (error) {
        console.error('Error in getRecentSessionsHistory:', error);
        throw error;
    }
};

module.exports = {
    getSalesCardData,
    getTransactionLedger,
    getZReportData,
    getTodaysSalesTrend,
    getRecentSessionsHistory
};
