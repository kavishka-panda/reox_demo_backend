const prisma = require('../config/prismaClient');

function requireRole(roleName) {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }

            const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { role: true } });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const userRoleName = user.role?.user_role || null;
            if (!userRoleName || userRoleName.toLowerCase() !== String(roleName).toLowerCase()) {
                return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
            }

            // attach resolved role name for downstream handlers if needed
            req.user.role_name = userRoleName;
            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({ success: false, message: 'Authorization failed' });
        }
    };
}

const requireAdmin = requireRole('Admin');

module.exports = { requireRole, requireAdmin };
