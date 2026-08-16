const prisma = require('../config/prismaClient');
const { runWithOutboxHandled } = require('./outboxContext');

const OUTBOX_TABLE = 'sync_outbox';

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

class DualWriteService {
    constructor(localPrisma) {
        this.localPrisma = localPrisma;
    }

    resolveRecordId(tableName, result, where) {
        const primaryKey = getPrimaryKey(tableName);

        if (result && typeof result === 'object' && result[primaryKey] !== undefined && result[primaryKey] !== null) {
            return result[primaryKey];
        }

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

    async enqueueOutbox(tx, tableName, recordId, action, payload) {
        if (!tableName || recordId === null || recordId === undefined) {
            throw new Error(`Failed to enqueue outbox event for ${tableName} ${action}: missing record id`);
        }

        const payloadJson = JSON.stringify(payload ?? {});

        await tx.$executeRawUnsafe(
            `INSERT INTO \`${OUTBOX_TABLE}\` (\`table_name\`, \`record_id\`, \`action\`, \`payload\`, \`status\`, \`retry_count\`, \`last_error\`, \`created_at\`, \`updated_at\`) VALUES (?, ?, ?, CAST(? AS JSON), 'pending', 0, NULL, NOW(3), NOW(3))`,
            tableName,
            String(recordId),
            action,
            payloadJson
        );
    }

    async createInTx(tx, tableName, params) {
        const localRecord = await tx[tableName].create(params);
        const recordId = this.resolveRecordId(tableName, localRecord, params?.where);
        await this.enqueueOutbox(tx, tableName, recordId, 'INSERT', localRecord);
        return localRecord;
    }

    async updateInTx(tx, tableName, params) {
        const localRecord = await tx[tableName].update(params);
        const recordId = this.resolveRecordId(tableName, localRecord, params?.where);
        await this.enqueueOutbox(tx, tableName, recordId, 'UPDATE', localRecord);
        return localRecord;
    }

    async deleteInTx(tx, tableName, params) {
        const deletedRecord = await tx[tableName].delete(params);
        const recordId = this.resolveRecordId(tableName, deletedRecord, params?.where);
        await this.enqueueOutbox(tx, tableName, recordId, 'DELETE', deletedRecord);
        return deletedRecord;
    }

    async create(tableName, params) {
        return runWithOutboxHandled(() => this.localPrisma.$transaction(async (tx) => {
            return this.createInTx(tx, tableName, params);
        }));
    }

    async update(tableName, params) {
        return runWithOutboxHandled(() => this.localPrisma.$transaction(async (tx) => {
            return this.updateInTx(tx, tableName, params);
        }));
    }

    async delete(tableName, params) {
        return runWithOutboxHandled(() => this.localPrisma.$transaction(async (tx) => {
            return this.deleteInTx(tx, tableName, params);
        }));
    }

    async createMany(tableName, params) {
        return runWithOutboxHandled(() => this.localPrisma.$transaction(async (tx) => {
            const items = Array.isArray(params?.data) ? params.data : [];
            let count = 0;

            for (const item of items) {
                await this.createInTx(tx, tableName, { data: item });
                count++;
            }

            return { count };
        }));
    }

    async updateMany(tableName, params) {
        return runWithOutboxHandled(() => this.localPrisma.$transaction(async (tx) => {
            const primaryKey = getPrimaryKey(tableName);
            const where = params?.where || {};
            const data = params?.data || {};

            const targets = await tx[tableName].findMany({
                where,
                select: { [primaryKey]: true }
            });

            let count = 0;
            for (const target of targets) {
                await this.updateInTx(tx, tableName, {
                    where: { [primaryKey]: target[primaryKey] },
                    data
                });
                count++;
            }

            return { count };
        }));
    }

    async deleteMany(tableName, params) {
        return runWithOutboxHandled(() => this.localPrisma.$transaction(async (tx) => {
            const primaryKey = getPrimaryKey(tableName);
            const where = params?.where || {};

            const targets = await tx[tableName].findMany({ where });
            let count = 0;

            for (const target of targets) {
                await this.deleteInTx(tx, tableName, {
                    where: { [primaryKey]: target[primaryKey] }
                });
                count++;
            }

            return { count };
        }));
    }
}

module.exports = new DualWriteService(prisma);
