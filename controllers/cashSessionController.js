const cashSessionModel = require('../models/cashSessionModel');

const cashSessionController = {
    async checkActiveCashSession(req, res) {
        try {
            const { userId, counterCode } = req.query;

            if (!userId || !counterCode) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID and Counter Code are required'
                });
            }

            const session = await cashSessionModel.checkActiveCashSession(
                parseInt(userId),
                counterCode
            );

            res.json({
                success: true,
                hasActiveSession: !!session,
                session: session
            });
        } catch (error) {
            console.error('Error checking cash session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check cash session'
            });
        }
    },

    async getCashierCounters(req, res) {
        try {
            const counters = await cashSessionModel.getCashierCounters();
            res.json(counters);
        } catch (error) {
            console.error('Error fetching cashier counters:', error);
            res.status(500).json({ error: 'Failed to fetch cashier counters' });
        }
    },

    async createCashSession(req, res) {
        try {
            const sessionId = await cashSessionModel.createCashSession(req.body);
            res.status(201).json({
                success: true,
                sessionId,
                message: 'Cash session created successfully'
            });
        } catch (error) {
            console.error('Error creating cash session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create cash session'
            });
        }
    },

    async getAllSessions(req, res) {
        try {
            const { date, userId, status, fromDate, toDate, counterId } = req.query;
            
            console.log('getAllSessions called with filters:', { date, userId, status, fromDate, toDate, counterId });
            
            const sessions = await cashSessionModel.getAllSessions({
                date,
                userId: userId ? parseInt(userId) : null,
                status: status ? parseInt(status) : null,
                counterId: counterId ? parseInt(counterId) : null,
                fromDate,
                toDate
            });

            res.json({
                success: true,
                data: sessions
            });
        } catch (error) {
            console.error('Error fetching sessions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch sessions',
                error: error.message
            });
        }
    },

    async getSessionDetails(req, res) {
        try {
            const { id } = req.params;
            
            const sessionDetail = await cashSessionModel.getSessionDetails(parseInt(id));
            
            if (!sessionDetail) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }

            res.json({
                success: true,
                data: sessionDetail
            });
        } catch (error) {
            console.error('Error fetching session details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch session details',
                error: error.message
            });
        }
    },

    async closeSession(req, res) {
        try {
            const { id } = req.params;
            const { actualBalance } = req.body;

            await cashSessionModel.closeSession(parseInt(id), parseFloat(actualBalance));

            res.json({
                success: true,
                message: 'Session closed successfully'
            });
        } catch (error) {
            console.error('Error closing session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to close session',
                error: error.message
            });
        }
    }
};

module.exports = cashSessionController;
