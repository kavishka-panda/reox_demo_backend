const prisma = require('../config/prismaClient');
const db = require('../services/dbWrapper');

class MoneyExchangeController {
    constructor() {
        this.getCurrentBalance = this.getCurrentBalance.bind(this);
        this.createTransaction = this.createTransaction.bind(this);
        this.getTransactionHistory = this.getTransactionHistory.bind(this);
        this._getBalanceData = this._getBalanceData.bind(this);
    }

    async getCurrentBalance(req, res) {
        try {
            const userId = req.user.id;
            const balanceData = await this._getBalanceData(userId);

            return res.json({
                success: true,
                data: balanceData
            });
        } catch (error) {
            if (error.message === 'No active session found') {
                return res.status(404).json({
                    success: false,
                    message: 'No active session found'
                });
            }
            console.error('Get balance error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get current balance',
                error: error.message
            });
        }
    }

    async createTransaction(req, res) {
        try {
            const { sessionId, transactionType, amount, description } = req.body;
            const userId = req.user.id;

            if (!sessionId || !transactionType || !amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Amount must be greater than 0'
                });
            }

            // Verify session belongs to user and is open
            const session = await prisma.cash_sessions.findFirst({
                where: {
                    id: parseInt(sessionId),
                    user_id: userId,
                    cash_status_id: 1
                }
            });

            if (!session) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or closed session'
                });
            }

            // Ensure exchange types exist and get their IDs
            let typeIn = await prisma.exchange_type.findFirst({ where: { exchange_type: 'Cash In' } });
            let typeOut = await prisma.exchange_type.findFirst({ where: { exchange_type: 'Cash Out' } });

            if (!typeIn || !typeOut) {
                // Initial seeding if missing
                if (!typeIn) {
                    await db.exchange_type.create({
                        data: { exchange_type: 'Cash In' }
                    });
                }

                if (!typeOut) {
                    await db.exchange_type.create({
                        data: { exchange_type: 'Cash Out' }
                    });
                }

                typeIn = await prisma.exchange_type.findFirst({ where: { exchange_type: 'Cash In' } });
                typeOut = await prisma.exchange_type.findFirst({ where: { exchange_type: 'Cash Out' } });
            }

            const exchangeTypeId = transactionType === 'cash-in' ? typeIn.id : typeOut.id;
            const now = new Date();

            // Insert transaction
            const result = await db.money_exchange.create({
                data: {
                    cash_sessions_id: parseInt(sessionId),
                    exchange_type_id1: exchangeTypeId,
                    amount: parseFloat(amount),
                    reason: description || '',
                    datetime: now
                }
            });

            // Get updated balance
            const balanceData = await this._getBalanceData(userId);

            return res.json({
                success: true,
                message: `${transactionType === 'cash-in' ? 'Cash in' : 'Cash out'} recorded successfully`,
                data: {
                    transactionId: result.id,
                    ...balanceData
                }
            });
        } catch (error) {
            console.error('Create transaction error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to record transaction',
                error: error.message
            });
        }
    }

    async getTransactionHistory(req, res) {
        try {
            const userId = req.user.id;
            const { sessionId } = req.query;

            const whereClause = {
                cash_sessions: {
                    user_id: userId
                }
            };

            if (sessionId) {
                whereClause.cash_sessions_id = parseInt(sessionId);
            }

            const transactions = await prisma.money_exchange.findMany({
                where: whereClause,
                include: {
                    cash_sessions: {
                        include: {
                            user: true
                        }
                    },
                    exchange_type: true
                },
                orderBy: {
                    datetime: 'desc'
                }
            });
            
            // Map keys to frontend expectation
            const mappedTransactions = transactions.map(t => ({
                id: t.id,
                session_id: t.cash_sessions_id,
                transaction_type: t.exchange_type_id1 === 1 ? 'cash-in' : 'cash-out',
                amount: t.amount,
                description: t.reason,
                created_at: t.datetime,
                created_by_name: t.cash_sessions?.user?.name
            }));

            return res.json({
                success: true,
                data: mappedTransactions
            });
        } catch (error) {
            console.error('Get history error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get transaction history',
                error: error.message
            });
        }
    }

    // Helper method to get balance data
    async _getBalanceData(userId) {
        // Find the most recent ACTIVE session for this user
        const session = await prisma.cash_sessions.findFirst({
            where: {
                user_id: parseInt(userId),
                cash_status_id: 1 // ACTIVE
            },
            orderBy: {
                opening_date_time: 'desc'
            }
        });

        if (!session) {
            throw new Error('No active session found');
        }

        let currentBalance = parseFloat(session.opening_balance || 0) + parseFloat(session.cash_total || 0);

        // Get money exchange transactions aggregation
        // Include refunds (reason starts with "Refund for Invoice")
        const aggregations = await prisma.money_exchange.groupBy({
             by: ['exchange_type_id1'],
             where: { 
                 cash_sessions_id: session.id
             },
             _sum: { amount: true }
         });

        // Get total refund (returns) amount for this session
        const refundAggregation = await prisma.money_exchange.aggregate({
             where: {
                 cash_sessions_id: session.id,
                 reason: {
                     startsWith: 'Refund for Invoice'
                 }
             },
             _sum: { amount: true }
        });
        const returnAmount = parseFloat(refundAggregation._sum.amount || 0);

        // Get IDs for accurate calculation
        const typeIn = await prisma.exchange_type.findFirst({ where: { exchange_type: 'Cash In' } });
        const typeOut = await prisma.exchange_type.findFirst({ where: { exchange_type: 'Cash Out' } });

        let exchangeTotal = 0;
        aggregations.forEach(agg => {
            const amt = parseFloat(agg._sum.amount || 0);
            if (typeIn && agg.exchange_type_id1 === typeIn.id) {
                exchangeTotal += amt;
            } else if (typeOut && agg.exchange_type_id1 === typeOut.id) {
                exchangeTotal -= amt;
            }
        });

        // Current Balance = Opening Balance + Cash Sales + Exchange Total - Return Amount
        currentBalance = currentBalance + exchangeTotal - returnAmount;

        return {
            sessionId: session.id,
            openingBalance: parseFloat(session.opening_balance || 0),
            cashAmount: parseFloat(session.cash_total || 0),
            exchangeTotal: exchangeTotal,
            returnAmount: returnAmount,
            currentBalance: currentBalance
        };
    }
}

module.exports = new MoneyExchangeController();
