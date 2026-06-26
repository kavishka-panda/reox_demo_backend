const prisma = require("../config/prismaClient");

class Product {
  static async checkIdExists(tableName, idColumn, idValue) {
    // Using raw query for dynamic table names to match previous behavior safely
    const result = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM ${tableName} WHERE ${idColumn} = ? LIMIT 1`,
      idValue
    );
    // Result is an array of objects.
    // If returning BigInt, serialize it. But standard check just needs length.
    return result.length > 0;
  }

  static async getVariationById(id) {
    return await prisma.product_variations.findUnique({
        where: { id: parseInt(id) }
    });
  }

  static async getProductByCode(code) {
    return await prisma.product.findUnique({
        where: { product_code: code }
    });
  }

  static async create(productData, variations) {
    try {
      return await prisma.$transaction(async (tx) => {
        let batchId = null;

        // Check if any variation has initial stock
        const hasInitialStock = variations.some(v => v.initialQty && Number(v.initialQty) > 0);

        if (hasInitialStock) {
          const batch = await tx.batch.create({
            data: {
              batch_name: `Initial Stock - ${new Date().toISOString().split('T')[0]}`,
            }
          });
          batchId = batch.id;
        }

        const newProduct = await tx.product.create({
          data: {
            product_name: productData.name,
            product_code: productData.code,
            category_id: productData.categoryId,
            brand_id: productData.brandId,
            unit_id: productData.unitId,
            product_type_id: productData.typeId,
            product_variations: {
              create: variations.map((variant) => ({
                barcode: variant.barcode,
                color: variant.color,
                size: variant.size,
                storage_capacity: variant.capacity,
                product_status_id: variant.statusId,
                // Create stock if initial quantity is provided
                stock: (variant.initialQty && Number(variant.initialQty) > 0) ? {
                  create: {
                    qty: Number(variant.initialQty),
                    cost_price: Number(variant.costPrice || 0),
                    mrp: Number(variant.mrp || 0),
                    rsp: Number(variant.rsp || 0),
                    wsp: Number(variant.wsp || 0),
                    barcode: variant.barcode,
                    batch_id: batchId,
                    mfd: variant.mfgDate ? new Date(variant.mfgDate) : null,
                    exp: variant.expDate ? new Date(variant.expDate) : null
                  }
                } : undefined
              })),
            },
          },
        });
        return newProduct.id;
      });
    } catch (error) {
      throw error;
    }
  }

  static async getProductsByStatus(statusId = 1) {
    const products = await prisma.product.findMany({
      where: {
        product_variations: {
          some: {
            product_status_id: statusId,
          },
        },
      },
      include: {
        category: true,
        brand: true,
        unit_id_product_unit_idTounit_id: true,
        product_type: true,
        product_variations: {
          where: {
            product_status_id: statusId,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    if (statusId === 2) {
      return products.flatMap((p) => {
        const categoryName = p.category ? p.category.name : null;
        const brandName = p.brand ? p.brand.name : null;
        const unitName = p.unit_id_product_unit_idTounit_id ? p.unit_id_product_unit_idTounit_id.name : null;
        const typeName = p.product_type ? p.product_type.name : null;

        return p.product_variations.map(pv => ({
          productID: p.id,
          pvId: pv.id,
          productName: p.product_name,
          baseProductName: p.product_name,
          productCode: p.product_code,
          barcode: pv.barcode || '',
          category: categoryName,
          categoryId: p.category_id,
          brand: brandName,
          brandId: p.brand_id,
          unit: unitName,
          unitId: p.unit_id,
          productType: typeName,
          productTypeId: p.product_type_id,
          color: pv.color || 'Default',
          size: pv.size || 'Default',
          storage: pv.storage_capacity || 'N/A',
          createdOn: p.created_at ? p.created_at.toISOString().split("T")[0] : null,
        }));
      });
    }

    return products.map((p) => {
      const pv = p.product_variations[0] || {};
      const categoryName = p.category ? p.category.name : null;
      const brandName = p.brand ? p.brand.name : null;
      const unitName = p.unit_id_product_unit_idTounit_id ? p.unit_id_product_unit_idTounit_id.name : null;
      const typeName = p.product_type ? p.product_type.name : null;

      return {
        productID: p.id,
        pvId: pv.id,
        productName: p.product_name,
        baseProductName: p.product_name,
        productCode: p.product_code,
        barcode: pv.barcode || '',
        category: categoryName,
        categoryId: p.category_id,
        brand: brandName,
        brandId: p.brand_id,
        unit: unitName,
        unitId: p.unit_id,
        productType: typeName,
        productTypeId: p.product_type_id,
        color: pv.color || 'Default',
        size: pv.size || 'Default',
        storage: pv.storage_capacity || 'N/A',
        createdOn: p.created_at ? p.created_at.toISOString().split("T")[0] : null,
      };
    });
  }

  static async getProductsForDropdown(statusId = 1, searchTerm = '', limit = 10) {
    console.log(`Model getProductsForDropdown - Search: '${searchTerm}', Limit: '${limit}'`);
    const take = parseInt(limit) || 10;
    const where = {
      product_variations: {
        some: {
          product_status_id: statusId,
        },
      },
    };

    if (searchTerm) {
      where.OR = [
        { product_name: { contains: searchTerm } },
        { product_code: { contains: searchTerm } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        product_name: true,
        product_code: true,
      },
      orderBy: {
        product_name: "asc",
      },
      take: take,
    });
    return products;
  }

  static async getProductVariantsByProductId(productId, statusId = null) {
    const where = {
      product_id: parseInt(productId),
    };

    if (statusId !== null) {
      where.product_status_id = parseInt(statusId);
    }

    const variants = await prisma.product_variations.findMany({
      where,
      select: {
        id: true,
        product_id: true,
        barcode: true,
        color: true,
        size: true,
        storage_capacity: true,
        product_status_id: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return variants.map((row) => ({
      ...row,
      pvId: row.id,
      statusId: row.product_status_id,
      storage: row.storage_capacity,
      variant_name: `${row.color || "Default"} - ${row.size || "Default"} - ${
        row.storage_capacity || "N/A"
      }`,
    }));
  }

  static async updateProductVariation(pvID, productData, variationData) {
    return await prisma.$transaction(async (tx) => {
      const parsedPvID = parseInt(pvID);
      if (isNaN(parsedPvID)) {
        throw new Error("Invalid product variation ID");
      }

      const variation = await tx.product_variations.findUnique({
        where: { id: parsedPvID },
        select: { product_id: true },
      });

      if (!variation) {
        throw new Error("Product variation not found");
      }

      const productId = variation.product_id;

      // Parse and validate IDs
      const categoryId = parseInt(productData.categoryId);
      const brandId = parseInt(productData.brandId);
      const unitId = parseInt(productData.unitId);
      const typeId = parseInt(productData.typeId);

      if (isNaN(categoryId) || isNaN(brandId) || isNaN(unitId) || isNaN(typeId)) {
        throw new Error("Invalid product data: category, brand, unit, or type ID is not a valid number");
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          product_name: productData.name,
          product_code: productData.code,
          category_id: categoryId,
          brand_id: brandId,
          unit_id: unitId,
          product_type_id: typeId,
        },
      });

      const statusId = parseInt(variationData.statusId);
      
      await tx.product_variations.update({
        where: { id: parsedPvID },
        data: {
          barcode: variationData.barcode,
          color: variationData.color || 'Default',
          size: variationData.size || 'Default',
          storage_capacity: variationData.storage || 'N/A',
          product_status_id: isNaN(statusId) ? 1 : statusId,
        },
      });

      return true;
    });
  }

  static async searchProducts(filter, statusId = 1) {
    const whereClause = {
      product_variations: {
        some: {
          product_status_id: statusId,
        },
      },
    };

    if (
      filter.productTypeId &&
      filter.productTypeId !== "null" &&
      filter.productTypeId !== "undefined"
    ) {
      whereClause.product_type_id = Number(filter.productTypeId);
    }

    if (
      filter.unitId &&
      filter.unitId !== "null" &&
      filter.unitId !== "undefined"
    ) {
      whereClause.unit_id = Number(filter.unitId);
    }

    if (
      filter.searchTerm &&
      filter.searchTerm !== "null" &&
      filter.searchTerm !== "undefined"
    ) {
      const search = filter.searchTerm;
      const searchConditions = [
        { product_name: { contains: search } },
        { product_code: { contains: search } },
        { product_variations: { some: { barcode: { contains: search } } } },
      ];

      if (!isNaN(parseInt(search))) {
        searchConditions.push({ id: parseInt(search) });
      }

      whereClause.OR = searchConditions;
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        brand: true,
        unit_id_product_unit_idTounit_id: true,
        product_type: true,
        product_variations: {
          where: { product_status_id: statusId },
        },
      },
      orderBy: { created_at: "desc" },
    });

    if (statusId === 2) {
      return products.flatMap((p) => {
        const categoryName = p.category ? p.category.name : null;
        const brandName = p.brand ? p.brand.name : null;
        const unitName = p.unit_id_product_unit_idTounit_id ? p.unit_id_product_unit_idTounit_id.name : null;
        const typeName = p.product_type ? p.product_type.name : null;

        return p.product_variations.map(pv => ({
          productID: p.id,
          pvId: pv.id,
          productName: p.product_name,
          baseProductName: p.product_name,
          productCode: p.product_code,
          barcode: pv.barcode || '',
          category: categoryName,
          categoryId: p.category_id,
          brand: brandName,
          brandId: p.brand_id,
          unit: unitName,
          unitId: p.unit_id,
          productType: typeName,
          productTypeId: p.product_type_id,
          color: pv.color || 'Default',
          size: pv.size || 'Default',
          storage: pv.storage_capacity || 'N/A',
          createdOn: p.created_at ? p.created_at.toISOString().split("T")[0] : null,
        }));
      });
    }

    return products.map((p) => {
      const pv = p.product_variations[0] || {};
      const categoryName = p.category ? p.category.name : null;
      const brandName = p.brand ? p.brand.name : null;
      const unitName = p.unit_id_product_unit_idTounit_id ? p.unit_id_product_unit_idTounit_id.name : null;
      const typeName = p.product_type ? p.product_type.name : null;

      return {
        productID: p.id,
        pvId: pv.id,
        productName: p.product_name,
        baseProductName: p.product_name,
        productCode: p.product_code,
        barcode: pv.barcode || '',
        category: categoryName,
        categoryId: p.category_id,
        brand: brandName,
        brandId: p.brand_id,
        unit: unitName,
        unitId: p.unit_id,
        productType: typeName,
        productTypeId: p.product_type_id,
        color: pv.color || 'Default',
        size: pv.size || 'Default',
        storage: pv.storage_capacity || 'N/A',
        createdOn: p.created_at ? p.created_at.toISOString().split("T")[0] : null,
      };
    });
  }

  static async updateProductStatus(pvId, statusId) {
    try {
      await prisma.product_variations.update({
        where: { id: parseInt(pvId) },
        data: { product_status_id: parseInt(statusId) },
      });
      return { affectedRows: 1 };
    } catch (error) {
      if (error.code === 'P2025') {
        return { affectedRows: 0 };
      }
      throw error;
    }
  }

  static async deleteProductVariation(pvId) {
    try {
      await prisma.product_variations.delete({
        where: { id: parseInt(pvId) },
      });
      return { affectedRows: 1 };
    } catch (error) {
      if (error.code === 'P2025') {
        return { affectedRows: 0 };
      }
      throw error;
    }
  }

  static async addVariation(productId, variationData) {
    return await prisma.product_variations.create({
      data: {
        product_id: parseInt(productId),
        barcode: variationData.barcode,
        color: variationData.color || 'Default',
        size: variationData.size || 'Default',
        storage_capacity: variationData.storage || 'N/A',
        product_status_id: parseInt(variationData.statusId) || 1,
      }
    });
  }

  static async getAllVariations(statusId = 1) {
    const products = await prisma.product.findMany({
      where: {
        product_variations: {
          some: {
            product_status_id: statusId,
          },
        },
      },
      include: {
        category: true,
        brand: true,
        unit_id_product_unit_idTounit_id: true,
        product_type: true,
        product_variations: {
          where: {
            product_status_id: statusId,
          },
          include: {
            stock: true
          }
        },
      },
      orderBy: { created_at: "desc" },
    });

    return products.flatMap((p) => {
      const categoryName = p.category ? p.category.name : null;
      const brandName = p.brand ? p.brand.name : null;
      const unitName = p.unit_id_product_unit_idTounit_id ? p.unit_id_product_unit_idTounit_id.name : null;
      const typeName = p.product_type ? p.product_type.name : null;

      return p.product_variations.map(pv => {
        const currentStock = pv.stock ? pv.stock.reduce((sum, item) => sum + (item.qty || 0), 0) : 0;
        
        return {
          productID: p.id,
          pvId: pv.id,
          productName: pv.color !== 'Default' || pv.size !== 'Default' 
            ? `${p.product_name} (${pv.color || ''} ${pv.size || ''})`
            : p.product_name,
          baseProductName: p.product_name,
          productCode: p.product_code,
          barcode: pv.barcode || '',
          category: categoryName,
          categoryId: p.category_id,
          brand: brandName,
          brandId: p.brand_id,
          unit: unitName,
          unitId: p.unit_id,
          productType: typeName,
          productTypeId: p.product_type_id,
          color: pv.color || 'Default',
          size: pv.size || 'Default',
          storage: pv.storage_capacity || 'N/A',
          stock: currentStock,
          createdOn: p.created_at ? p.created_at.toISOString().split("T")[0] : null,
        };
      });
    });
  }
}

module.exports = Product;
