const prisma = require('../config/prismaClient'); 

class Reason {
    static async getAllReasons() {
        const reasons = await prisma.reason.findMany({
            orderBy: {
                id: 'asc'
            }
        });
        return reasons;
    }
    
    static async createReason(reasonText) {
        const result = await prisma.reason.create({
            data: {
                reason: reasonText
            }
        });
        return result;
    }
}

module.exports = Reason;