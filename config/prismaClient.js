/**
 * Prisma Client Configuration
 * 
 * ARCHITECTURE:
 * - This file exports a LOCAL-ONLY Prisma client
 * - ALL models and controllers use LOCAL database through this client
 * - BackgroundSyncWorker syncs pending records to online database
 * - The Prisma client NEVER switches - it's always connected to local DB
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { isOutboxHandledByDualWrite } = require('../services/outboxContext');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Local database configuration (from .env)
const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
const dbPort = DB_PORT || '3306';
const encodedPassword = encodeURIComponent(DB_PASSWORD || '');
const localDatabaseUrl = `mysql://${DB_USER}:${encodedPassword}@${DB_HOST}:${dbPort}/${DB_NAME}?connection_limit=20&pool_timeout=30`;

// Create LOCAL-ONLY Prisma Client
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: localDatabaseUrl
        }
    }
});

const OUTBOX_TABLE = 'sync_outbox';
const OUTBOX_EXCLUDED_TABLES = ['db_config', 'subscription', OUTBOX_TABLE];
const PRIMARY_KEY_MAP = {
    brand: 'idbrand',
    category: 'idcategory',
    product_status: 'idproduct_status',
    product_type: 'idproduct_type',
    unit_id: 'idunit_id'
};

function getPrimaryKey(tableName) {
    return PRIMARY_KEY_MAP[tableName] || 'id';
}

function getTableNameFromModel(modelName) {
    if (!modelName) return null;
    if (modelName === 'Return') return 'return';
    return modelName.toLowerCase();
}

function getRecordId(tableName, params, result) {
    const primaryKey = getPrimaryKey(tableName);

    if (result && typeof result === 'object' && result[primaryKey] !== undefined && result[primaryKey] !== null) {
        return result[primaryKey];
    }

    const where = params?.args?.where;
    if (where && typeof where === 'object') {
        if (where[primaryKey] !== undefined && where[primaryKey] !== null) {
            return where[primaryKey];
        }
        if (where.id !== undefined && where.id !== null) {
            return where.id;
        }
    }

    return null;
}

async function enqueueOutboxEvent(tableName, action, recordId, payload) {
    if (!tableName || OUTBOX_EXCLUDED_TABLES.includes(tableName)) {
        return;
    }

    if (recordId === null || recordId === undefined) {
        throw new Error(`Unable to resolve record_id for ${tableName} ${action}`);
    }

    const payloadJson = JSON.stringify(payload ?? {});
    await prisma.$executeRawUnsafe(
        `INSERT INTO \`${OUTBOX_TABLE}\` (\`table_name\`, \`record_id\`, \`action\`, \`payload\`, \`status\`, \`retry_count\`, \`last_error\`, \`created_at\`, \`updated_at\`) VALUES (?, ?, ?, ?, 'pending', 0, NULL, NOW(3), NOW(3))`,
        tableName,
        String(recordId),
        action,
        payloadJson
    );
}

prisma.$use(async (params, next) => {
    const trackedActions = ['create', 'update', 'delete', 'upsert'];
    if (!trackedActions.includes(params.action)) {
        return next(params);
    }

    const tableName = getTableNameFromModel(params.model);
    if (!tableName || OUTBOX_EXCLUDED_TABLES.includes(tableName)) {
        return next(params);
    }

    if (isOutboxHandledByDualWrite()) {
        return next(params);
    }

    let preExisting = null;
    if (params.action === 'upsert') {
        preExisting = await prisma[params.model]?.findUnique({
            where: params.args.where
        });
    }

    const result = await next(params);

    let outboxAction = null;
    if (params.action === 'create') outboxAction = 'INSERT';
    if (params.action === 'update') outboxAction = 'UPDATE';
    if (params.action === 'delete') outboxAction = 'DELETE';
    if (params.action === 'upsert') outboxAction = preExisting ? 'UPDATE' : 'INSERT';

    const recordId = getRecordId(tableName, params, result);
    await enqueueOutboxEvent(tableName, outboxAction, recordId, result);
    return result;
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📊 Prisma Client (LOCAL DB ONLY)`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Host: ${DB_HOST}`);
console.log(`Database: ${DB_NAME}`);
console.log(`User: ${DB_USER}`);
console.log(`Port: ${dbPort}`);
console.log(`Pool: 20 connections, 30s timeout`);
console.log(`Note: This client ALWAYS stays on local DB`);
console.log(`✅ Outbox-driven writes enabled via DualWriteService + middleware fallback`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

// Export LOCAL-ONLY Prisma client
// All models and controllers will use this client for local database access
// Outbox records are synced by BackgroundSyncWorker
module.exports = prisma;
