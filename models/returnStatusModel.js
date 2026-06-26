const prisma = require('../config/prismaClient');

class ReturnStatus {
    static async getAllReturnStatuses() {
        try {
            const statuses = await prisma.return_status.findMany({
                orderBy: {
                    id: 'asc'
                }
            });
            return statuses.map(s => ({
                id: s.id,
                name: s.return_status
            }));
        } catch (error) {
            console.error('Database query failed:', error);
            throw new Error('Failed to retrieve return statuses');
        }
    }
}

module.exports = ReturnStatus;