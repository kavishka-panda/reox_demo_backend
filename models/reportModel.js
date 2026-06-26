const prisma = require("../config/prismaClient");
const { getCriticalReorderList } = require("./inventoryReportModel");

class Report {
    
    // Get detailed report data based on filter
    static async getFilteredReport(filter) {
        const { dateFrom, dateTo, reportType } = filter;
        
        let where = {};
        if (dateFrom && dateTo) {
            where.created_at = {
                gte: new Date(dateFrom),
                lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999))
            };
        }

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                invoice_items: {
                    include: {
                        stock: true
                    }
                }
            }
        });

        // Grouping based on reportType (daily, weekly, monthly)
        const grouped = invoices.reduce((acc, inv) => {
            let key;
            const date = new Date(inv.created_at);
            
            if (reportType === 'monthly') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else if (reportType === 'weekly') {
                // Simplified week key
                const oneJan = new Date(date.getFullYear(), 0, 1);
                const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
                const weekNum = Math.ceil(( date.getDay() + 1 + numberOfDays) / 7);
                key = `${date.getFullYear()}-W${weekNum}`;
            } else {
                key = inv.created_at.toISOString().split('T')[0];
            }

            if (!acc[key]) {
                acc[key] = { 
                    id: key, 
                    date: key, 
                    totalSales: 0, 
                    totalOrders: 0, 
                    profit: 0,
                    totalProducts: 0,
                    tax: 0,
                    discount: 0
                };
            }

            const cost = inv.invoice_items.reduce((sum, item) => sum + (item.qty * item.stock.cost_price), 0);
            
            acc[key].totalSales += inv.total;
            acc[key].totalOrders += 1;
            acc[key].profit += (inv.total - cost);
            acc[key].discount += (inv.discount + inv.extra_discount);
            acc[key].totalProducts += inv.invoice_items.length;
            // Assuming tax is included in total or subtotal, if specific tax column exists use it.
            // For now, let's say tax is 0 or estimated.
            acc[key].tax += (inv.total * 0.1); // Placeholder 10%

            return acc;
        }, {});

        return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    }

    // Get core dashboard statistics
    static async getDashboardStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            todaySales,
            supplierCount,
            productCount,
            customerCount,
            employeeCount,
            criticalReorderList
        ] = await Promise.all([
            // Today's Sales & Invoices
            prisma.invoice.aggregate({
                where: { created_at: { gte: today } },
                _sum: { total: true },
                _count: { id: true }
            }),
            // Entity Counts
            prisma.supplier.count({ where: { status_id: 1 } }),
            prisma.product.count(),
            prisma.customer.count({ where: { status_id: 1 } }),
            prisma.user.count({ where: { status_id: 1 } }),
            // Low Stock Items - from Critical Reorder List
            getCriticalReorderList()
        ]);

        // Get low stock count from critical reorder list
        const lowStockCount = Array.isArray(criticalReorderList) ? criticalReorderList.length : 0;

        // Monthly comparison for trends (Simplified)
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setHours(0, 0, 0, 0);

        const lastMonthSales = await prisma.invoice.aggregate({
            where: { created_at: { gte: lastMonth, lt: today } },
            _sum: { total: true }
        });

        const salesTrend = lastMonthSales._sum.total > 0 
            ? ((todaySales._sum.total || 0) / (lastMonthSales._sum.total / 30) - 1) * 100 
            : 0;

        return {
            todaySales: todaySales._sum.total || 0,
            todayInvoices: todaySales._count.id || 0,
            supplierCount,
            productCount,
            customerCount,
            employeeCount,
            lowStockCount
        };
    }

    // Get Stock Category Distribution
    static async getCategoryDistribution() {
        try {
            const products = await prisma.product.findMany({
                include: {
                    category: true,
                    product_variations: {
                        include: {
                            stock: true
                        }
                    }
                }
            });

            const groupedByCat = products.reduce((acc, prod) => {
                const catName = prod.category?.name || 'Uncategorized';
                if (!acc[catName]) acc[catName] = 0;
                
                const stockCount = prod.product_variations.reduce((vAcc, varn) => {
                    return vAcc + (varn.stock?.reduce((sAcc, st) => sAcc + (st.qty || 0), 0) || 0);
                }, 0);
                
                acc[catName] += stockCount;
                return acc;
            }, {});

            return Object.entries(groupedByCat)
                .map(([name, value]) => ({ name, value }))
                .filter(item => item.value > 0);
        } catch (error) {
            console.error('Error in getCategoryDistribution:', error);
            return [];
        }
    }

    static async getSessionTrend(days = 28) {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const currentStart = new Date(endDate);
        currentStart.setDate(currentStart.getDate() - (days - 1));
        currentStart.setHours(0, 0, 0, 0);

        const previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - days);

        const sessions = await prisma.cash_sessions.findMany({
            where: {
                opening_date_time: {
                    gte: previousStart,
                    lte: endDate
                }
            },
            select: {
                opening_date_time: true
            }
        });

        const grouped = sessions.reduce((acc, session) => {
            const key = session.opening_date_time.toISOString().split('T')[0];
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const series = [];
        let currentTotal = 0;
        let previousTotal = 0;
        const currentStartKey = currentStart.toISOString().split('T')[0];

        for (let i = 0; i < days; i++) {
            const date = new Date(currentStart);
            date.setDate(currentStart.getDate() + i);
            const key = date.toISOString().split('T')[0];
            const totalSessions = grouped[key] || 0;
            currentTotal += totalSessions;
            series.push({ date: key, totalSessions });
        }

        Object.entries(grouped).forEach(([key, count]) => {
            if (key < currentStartKey) {
                previousTotal += count;
            }
        });

        const trend = previousTotal > 0
            ? ((currentTotal - previousTotal) / previousTotal) * 100
            : currentTotal > 0
                ? 100
                : 0;

        return {
            series,
            totalSessions: currentTotal,
            previousSessions: previousTotal,
            trend,
            trendLabel: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`
        };
    }
}

module.exports = Report;
