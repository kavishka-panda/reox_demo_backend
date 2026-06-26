const prisma = require("../config/prismaClient");

class Brand {
    /**
     * @desc Create a new brand
     */
    static async createBrand(brandName) {
        const brand = await prisma.brand.create({
            data: { name: brandName }
        });
        return brand.idbrand;
    }

    /**
     * @desc Get all brands ordered by name
     */
    static async getAllBrand() {
        const brands = await prisma.brand.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
        return brands.map(b => ({
            id: b.idbrand,
            name: b.name,
            created_at: b.created_at ? b.created_at.toISOString().split('T')[0] : null
        }));
    }

    /**
     * @desc Search brands by name
     */
    static async searchBrands(searchTerm) {
        const brands = await prisma.brand.findMany({
            where: {
                name: {
                    contains: searchTerm
                }
            },
            take: 100
        });
        return brands.map(b => ({
            id: b.idbrand,
            name: b.name,
            created_at: b.created_at
        }));
    }

    /**
     * @desc Check if a brand name already exists (for duplicates)
     */
    static async checkNameExists(name, excludeId = null) {
        const where = {
            name: name.trim()
        };

        if (excludeId) {
            where.idbrand = { not: parseInt(excludeId) };
        }

        const brand = await prisma.brand.findFirst({ where });
        return !!brand;
    }

    static async getIdByName(name) {
        const query = "SELECT idbrand FROM brand WHERE name = ?";
        const [rows] = await db.execute(query, [name.trim()]);
        return rows.length > 0 ? rows[0].idbrand : null;
    }

    /**
     * @desc Update brand name
     */
    static async updateBrand(id, name) {
        try {
            await prisma.brand.update({
                where: { idbrand: parseInt(id) },
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
     * @desc Check if brand is being used by any product
     */
    static async isBrandUsed(id) {
        const product = await prisma.product.findFirst({
            where: { brand_id: parseInt(id) }
        });
        return !!product;
    }

    /**
     * @desc Delete brand by ID
     */
    static async deleteBrand(id) {
        try {
            await prisma.brand.delete({
                where: { idbrand: parseInt(id) }
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

module.exports = Brand;

