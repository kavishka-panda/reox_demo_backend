const prisma = require("../config/prismaClient");

class Unit {
    /**
     * @desc Create a new unit
     */
    static async createUnit(unitName) {
        const unit = await prisma.unit_id.create({
            data: { name: unitName }
        });
        return unit.idunit_id;
    }

    /**
     * @desc Get all units ordered by name
     */
    static async getAllUnits() {
        const units = await prisma.unit_id.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
        return units.map(u => ({
            id: u.idunit_id,
            name: u.name,
            created_at: u.created_at
        }));
    }

    /**
     * @desc Search units by name
     */
    static async searchUnits(searchTerm) {
        const units = await prisma.unit_id.findMany({
            where: {
                name: {
                    contains: searchTerm
                }
            },
            take: 100
        });
        return units.map(u => ({
            id: u.idunit_id,
            name: u.name,
            created_at: u.created_at
        }));
    }

    /**
     * @desc Check if a unit name exists (for duplicates)
     */
    static async checkNameExists(name, excludeId = null) {
        const where = {
            name: name.trim()
        };

        if (excludeId) {
            where.idunit_id = { not: parseInt(excludeId) };
        }

        const unit = await prisma.unit_id.findFirst({ where });
        return !!unit;
    }

    static async getIdByName(name) {
        const query = "SELECT idunit_id FROM unit_id WHERE name = ?";
        const [rows] = await db.execute(query, [name.trim()]);
        return rows.length > 0 ? rows[0].idunit_id : null;
    }

    /**
     * @desc Update unit name by ID
     */
    static async updateUnit(id, name) {
        try {
            await prisma.unit_id.update({
                where: { idunit_id: parseInt(id) },
                data: { name }
            });
            return { affectedRows: 1 };
        } catch (error) {
            if (error.code === 'P2025') {
                return { affectedRows: 0 };
            }
            throw error;
        }
    }

    /**
     * @desc Check if unit is linked to products before deletion
     */
    static async isUnitUsed(id) {
        const product = await prisma.product.findFirst({
            where: { unit_id: parseInt(id) }
        });
        return !!product;
    }

    /**
     * @desc Delete unit by ID
     */
    static async deleteUnit(id) {
        try {
            await prisma.unit_id.delete({
                where: { idunit_id: parseInt(id) }
            });
            return { affectedRows: 1 };
        } catch (error) {
            if (error.code === 'P2025') {
                return { affectedRows: 0 };
            }
            throw error;
        }
    }
}

module.exports = Unit;
