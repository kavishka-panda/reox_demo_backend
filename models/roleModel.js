const prisma = require('../config/prismaClient');

const Role = {
    // Get all roles from the database
    getAll: async () => {
        const roles = await prisma.role.findMany({
            orderBy: {
                user_role: 'asc'
            }
        });
        return roles;
    }
};

module.exports = Role;