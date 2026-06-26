const prisma = require('../config/prismaClient');

const cashSessionModel = {
    async checkActiveCashSession(userId, counterCode) {
        try {
            console.log('Checking session for:', { userId, counterCode });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const session = await prisma.cash_sessions.findFirst({
                where: {
                    user_id: userId,
                    cashier_counters: {
                        cashier_counter: counterCode
                    },
                    opening_date_time: {
                        gte: today,
                        lt: tomorrow
                    },
                    cash_status_id: 1
                },
                include: {
                    cashier_counters: {
                        select: {
                            cashier_counter: true
                        }
                    }
                }
            });

            console.log('Found session:', session ? session : 'No session');
            
            if (session) {
                return {
                    id: session.id,
                    opening_balance: session.opening_balance,
                    cashier_counter: session.cashier_counters.cashier_counter
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error checking cash session:', error);
            throw error;
        }
    },

    async getCashierCounters() {
        try {
            const counters = await prisma.cashier_counters.findMany({
                select: {
                    id: true,
                    cashier_counter: true
                },
                orderBy: {
                    cashier_counter: 'asc'
                }
            });
            return counters;
        } catch (error) {
            console.error('Error fetching cashier counters:', error);
            throw error;
        }
    },

    async createCashSession(session) {
        try {
            const result = await prisma.cash_sessions.create({
                data: {
                    opening_date_time: new Date(),
                    user_id: session.user_id,
                    opening_balance: session.opening_balance,
                    cash_total: session.cash_total,
                    card_total: session.card_total,
                    bank_total: session.bank_total,
                    cashier_counters_id: session.cashier_counter_id,
                    cash_status_id: session.cash_status_id
                }
            });
            return result.id;
        } catch (error) {
            console.error('Error creating cash session:', error);
            throw error;
        }
    },

    async getAllSessions(filters = {}) {
        try {
            // Build filter conditions
            const where = {};
            
            // Date filter - default to today if no date filter provided
            if (filters.date) {
                const targetDate = new Date(filters.date);
                targetDate.setHours(0, 0, 0, 0);
                const nextDay = new Date(targetDate);
                nextDay.setDate(nextDay.getDate() + 1);
                
                where.opening_date_time = {
                    gte: targetDate,
                    lt: nextDay
                };
            } else if (!filters.fromDate && !filters.toDate) {
                // Default to today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                where.opening_date_time = {
                    gte: today,
                    lt: tomorrow
                };
            } else if (filters.fromDate && filters.toDate) {
                const from = new Date(filters.fromDate);
                from.setHours(0, 0, 0, 0);
                const to = new Date(filters.toDate);
                to.setHours(23, 59, 59, 999);
                
                where.opening_date_time = {
                    gte: from,
                    lte: to
                };
            }

            // User filter
            if (filters.userId) {
                where.user_id = filters.userId;
            }

            // Counter filter
            if (filters.counterId) {
                where.cashier_counters_id = filters.counterId;
            }

            // Status filter
            if (filters.status) {
                where.cash_status_id = filters.status;
            }

            console.log('getAllSessions - Built where clause:', JSON.stringify(where, null, 2));

            const sessions = await prisma.cash_sessions.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            contact: true
                        }
                    },
                    cashier_counters: {
                        select: {
                            id: true,
                            cashier_counter: true
                        }
                    },
                    cash_status: {
                        select: {
                            id: true,
                            cash_status: true
                        }
                    },
                    money_exchange: {
                        include: {
                            exchange_type: true
                        },
                        orderBy: {
                            datetime: 'asc'
                        }
                    }
                },
                orderBy: {
                    opening_date_time: 'desc'
                }
            });

            // Calculate totals and format response
            return sessions.map(session => {
                // Calculate money exchange totals
                let cashIn = 0;
                let cashOut = 0;
                
                session.money_exchange.forEach(exchange => {
                    if (exchange.exchange_type_id1 === 1) {
                        cashIn += parseFloat(exchange.amount);
                    } else if (exchange.exchange_type_id1 === 2) {
                        cashOut += parseFloat(exchange.amount);
                    }
                });

                const openingBalance = parseFloat(session.opening_balance);
                const cashTotal = parseFloat(session.cash_total);
                const cardTotal = parseFloat(session.card_total);
                const bankTotal = parseFloat(session.bank_total);
                
                // Expected balance = opening + sales (cash, card, bank) + cash in - cash out
                const expectedBalance = openingBalance + cashTotal + cashIn - cashOut;

                return {
                    id: session.id,
                    cashier: {
                        id: session.user.id,
                        name: session.user.name,
                        email: session.user.email,
                        contact: session.user.contact
                    },
                    counter: session.cashier_counters.cashier_counter,
                    date: session.opening_date_time.toISOString().split('T')[0],
                    openingTime: session.opening_date_time.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                    }),
                    openingBalance,
                    cashTotal,
                    cardTotal,
                    bankTotal,
                    totalSales: cashTotal + cardTotal + bankTotal,
                    cashIn,
                    cashOut,
                    expectedBalance,
                    status: session.cash_status.cash_status,
                    statusId: session.cash_status.id,
                    transactionCount: session.money_exchange.length
                };
            });
        } catch (error) {
            console.error('Error fetching all sessions:', error);
            throw error;
        }
    },

    async getSessionDetails(sessionId) {
        try {
            const session = await prisma.cash_sessions.findUnique({
                where: { id: sessionId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            contact: true
                        }
                    },
                    cashier_counters: {
                        select: {
                            cashier_counter: true
                        }
                    },
                    cash_status: true,
                    money_exchange: {
                        include: {
                            exchange_type: true
                        },
                        orderBy: {
                            datetime: 'asc'
                        }
                    }
                }
            });

            if (!session) {
                return null;
            }

            // Calculate money exchange totals
            let cashIn = 0;
            let cashOut = 0;
            
            const transactions = session.money_exchange.map(exchange => {
                const amount = parseFloat(exchange.amount);
                
                if (exchange.exchange_type_id1 === 1) {
                    cashIn += amount;
                } else {
                    cashOut += amount;
                }

                return {
                    id: exchange.id,
                    type: exchange.exchange_type.exchange_type,
                    typeId: exchange.exchange_type_id1,
                    amount,
                    description: exchange.reason,
                    time: exchange.datetime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }),
                    datetime: exchange.datetime
                };
            });

            const openingBalance = parseFloat(session.opening_balance);
            const cashTotal = parseFloat(session.cash_total);
            const cardTotal = parseFloat(session.card_total);
            const bankTotal = parseFloat(session.bank_total);
            const expectedBalance = openingBalance + cashTotal + cashIn - cashOut;

            return {
                session: {
                    id: session.id,
                    cashier: session.user.name,
                    counter: session.cashier_counters.cashier_counter,
                    date: session.opening_date_time.toISOString().split('T')[0],
                    openingTime: session.opening_date_time.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }),
                    openingBalance,
                    cashTotal,
                    cardTotal,
                    bankTotal,
                    totalSales: cashTotal + cardTotal + bankTotal,
                    cashIn,
                    cashOut,
                    expectedBalance,
                    status: session.cash_status.cash_status
                },
                transactions
            };
        } catch (error) {
            console.error('Error fetching session details:', error);
            throw error;
        }
    },

    async closeSession(sessionId, actualBalance) {
        try {
            // Update session status to closed (assuming status 2 is closed)
            await prisma.cash_sessions.update({
                where: { id: sessionId },
                data: {
                    cash_status_id: 2,
                    // You might want to add actual_balance and closing_time fields to the schema
                }
            });
        } catch (error) {
            console.error('Error closing session:', error);
            throw error;
        }
    }
};

module.exports = cashSessionModel;
