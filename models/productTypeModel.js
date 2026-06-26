const prisma = require("../config/prismaClient");

class ProductType {
    /**
     * @desc Create a new product type
     */
    static async createProductType(productTypeName) {
        const productType = await prisma.product_type.create({
            data: { name: productTypeName }
        });
        return productType.idproduct_type;
    }

    /**
     * @desc Get all product types ordered by name
     */
    static async getAllProductTypes() {
        const productTypes = await prisma.product_type.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
        return productTypes.map(pt => ({
            id: pt.idproduct_type,
            name: pt.name,
            created_at: pt.created_at ? pt.created_at.toISOString().split('T')[0] : null
        }));
    }

    /**
     * @desc Search product types by name
     */
    static async searchProductTypes(searchTerm) {
        const productTypes = await prisma.product_type.findMany({
            where: {
                name: {
                    contains: searchTerm
                }
            },
            take: 100
        });
        return productTypes.map(pt => ({
            id: pt.idproduct_type,
            name: pt.name
        }));
    }

    /**
     * @desc Check if a product type name already exists (for duplicates)
     */
    static async checkNameExists(name, excludeId = null) {
        const where = {
            name: name.trim()
        };

        if (excludeId) {
            where.idproduct_type = { not: parseInt(excludeId) };
        }

        const productType = await prisma.product_type.findFirst({ where });
        return !!productType;
    }

    static async getIdByName(name) {
        const query = "SELECT idproduct_type FROM product_type WHERE name = ?";
        const [rows] = await db.execute(query, [name.trim()]);
        return rows.length > 0 ? rows[0].idproduct_type : null;
    }

    /**
     * @desc Update product type name
     */
    static async updateProductType(id, name) {
        try {
            await prisma.product_type.update({
                where: { idproduct_type: parseInt(id) },
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
     * @desc Check if product type is being used by any product before deletion
     */
    static async isProductTypeUsed(id) {
        const product = await prisma.product.findFirst({
            where: { product_type_id: parseInt(id) }
        });
        return !!product;
    }

    /**
     * @desc Delete product type by ID
     */
    static async deleteProductType(id) {
        try {
            await prisma.product_type.delete({
                where: { idproduct_type: parseInt(id) }
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

module.exports = ProductType;