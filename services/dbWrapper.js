/**
 * Database Wrapper Service
 * 
 * Provides simplified access to local Prisma operations.
 * All local writes are recorded in sync_outbox transactionally via DualWriteService.
 * BackgroundSyncWorker consumes sync_outbox and syncs to online DB.
 * 
 * READ operations should use prisma directly (faster, no overhead)
 * 
 * Usage:
 * ```javascript
 * const prisma = require('../config/prismaClient');
 * const db = require('../services/dbWrapper');
 * 
 * // CREATE
 * const category = await db.category.create({ data: { name: 'Electronics' } });
 * 
 * // UPDATE  
 * await db.category.update({ 
 *   where: { idcategory: 1 }, 
 *   data: { name: 'Electronics Updated' } 
 * });
 * 
 * // DELETE
 * await db.category.delete({ where: { idcategory: 1 } });
 * 
 * // READ (use prisma directly - faster)
 * const categories = await prisma.category.findMany();
 * ```
 */

const prisma = require('../config/prismaClient');
const dualWriteService = require('./dualWriteService');

// Create Proxy handler for database operations
const dbHandler = {
    get(target, tableName) {
        if (typeof tableName === 'symbol' || tableName === 'inspect') {
            return target[tableName];
        }

        return {
            /**
             * CREATE operation
             */
            async create(params) {
                return await dualWriteService.create(tableName, params);
            },

            /**
             * UPDATE operation
             */
            async update(params) {
                return await dualWriteService.update(tableName, params);
            },

            /**
             * DELETE operation
             */
            async delete(params) {
                return await dualWriteService.delete(tableName, params);
            },

            /**
             * For batch operations, use prisma directly.
             * If batch operations are used for business writes, emit outbox rows explicitly.
             */
            async createMany(params) {
                return await dualWriteService.createMany(tableName, params);
            },

            async updateMany(params) {
                return await dualWriteService.updateMany(tableName, params);
            },

            async deleteMany(params) {
                return await dualWriteService.deleteMany(tableName, params);
            },

            /**
             * READ operations - use prisma directly (no overhead)
             */
            async findUnique(params) {
                return await prisma[tableName].findUnique(params);
            },

            async findFirst(params) {
                return await prisma[tableName].findFirst(params);
            },

            async findMany(params) {
                return await prisma[tableName].findMany(params);
            },

            async count(params) {
                return await prisma[tableName].count(params);
            },

            async aggregate(params) {
                return await prisma[tableName].aggregate(params);
            },

            async groupBy(params) {
                return await prisma[tableName].groupBy(params);
            }
        };
    }
};

// Export Proxy instance
module.exports = new Proxy({}, dbHandler);
