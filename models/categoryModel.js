const prisma = require("../config/prismaClient");
const db = require("../services/dbWrapper"); // For write operations with dual-write support

class Category {
    /**
     * @desc Create a new category
     */
    static async createCategory(categoryName) {
        const category = await db.category.create({
            data: { name: categoryName }
        });
        return category.idcategory;
    }

    /**
     * @desc Get all categories ordered by name
     */
    static async getAllCategory() {
        const categories = await prisma.category.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
        return categories.map(c => ({
            id: c.idcategory,
            name: c.name,
            created_at: c.created_at ? c.created_at.toISOString().split('T')[0] : null
        }));
    }

    /**
     * @desc Search categories by name
     */
    static async searchCategories(searchTerm) {
        const categories = await prisma.category.findMany({
            where: {
                name: {
                    contains: searchTerm
                }
            },
            take: 100
        });
        return categories.map(c => ({
            id: c.idcategory,
            name: c.name,
            created_at: c.created_at
        }));
    }

    /**
     * @desc Check if a category name already exists
     */
    static async checkNameExists(name, excludeId = null) {
        const where = {
            name: name.trim()
        };

        if (excludeId) {
            where.idcategory = { not: parseInt(excludeId) };
        }

        const category = await prisma.category.findFirst({ where });
        return !!category;
    }

    static async getIdByName(name) {
        const query = "SELECT idcategory FROM category WHERE name = ?";
        const [rows] = await db.execute(query, [name.trim()]);
        return rows.length > 0 ? rows[0].idcategory : null;
    }

    /**
     * @desc Update category name
     */
    static async updateCategory(id, name) {
        try {
            await db.category.update({
                where: { idcategory: parseInt(id) },
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
     * @desc Check if category is being used by any product
     */
    static async isCategoryUsed(id) {
        const product = await prisma.product.findFirst({
            where: { category_id: parseInt(id) }
        });
        return !!product;
    }

    /**
     * @desc Delete category by ID
     */
    static async deleteCategory(id) {
        try {
            await db.category.delete({
                where: { idcategory: parseInt(id) }
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

module.exports = Category;

