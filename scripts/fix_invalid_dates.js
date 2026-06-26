require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDates() {
    try {
        console.log('Starting to fix invalid dates in MySQL using raw queries...');

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Tables to check based on schema
        const tables = [
            'bank', 'batch', 'brand', 'cash_sessions', 'cash_status',
            'cashier_counters', 'category', 'customer', 'damaged',
            'damaged_items', 'damaged_status', 'denominations', 'expenses',
            'grn', 'grn_items', 'grn_status', 'invoice', 'invoice_items',
            'invoice_status', 'money_exchange', 'money_exchange_types',
            'payment_types', 'product', 'product_status', 'product_type',
            'product_variations', 'quotation', 'quotation_items',
            'quotation_status', 'reasons', 'return_items', 'return_status',
            'returns', 'roles', 'selling_price_type', 'stock', 'subscription',
            'supplier', 'unit_id', 'user'
        ];

        for (const table of tables) {
            try {
                process.stdout.write(`Updating ${table} table... `);
                const result = await prisma.$executeRawUnsafe(
                    `UPDATE \`${table}\` SET updated_at = ? WHERE updated_at < '1970-01-01' OR updated_at IS NULL`,
                    now
                );
                console.log(`Updated ${result} rows.`);
            } catch (err) {
                // If table doesn't have updated_at column, just skip it
                if (err.message.includes('Unknown column \'updated_at\'')) {
                    console.log(`Skipped (no updated_at column).`);
                } else {
                    console.log(`Error: ${err.message}`);
                }
            }
        }

        console.log('Finished fixing dates.');
    } catch (error) {
        console.error('Final Error fixing dates:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixDates();



