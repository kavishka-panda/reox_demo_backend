const { PrismaClient } = require('@prisma/client');
const path = require('path');
const bcrypt = require('bcrypt');

// Ensure environment variables are loaded for the seed script
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

let prisma;
try {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('${')) {
    const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
    const dbPort = DB_PORT || '3306';
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    process.env.DATABASE_URL = `mysql://${DB_USER}:${encodedPassword}@${DB_HOST}:${dbPort}/${DB_NAME}`;
    console.log("Constructed DB URL:", process.env.DATABASE_URL.replace(encodedPassword, '********'));
  }
  prisma = new PrismaClient();
} catch (err) {
  console.error("Failed to init PrismaClient:", err);
  process.exit(1);
}

async function main() {
  console.log('🌱 Start seeding...');

  // 1. Create Roles
  const roles = ['Admin', 'Cashier', 'Manager'];
  for (const roleName of roles) {
    const exists = await prisma.role.findFirst({ where: { user_role: roleName } });
    if (!exists) {
      await prisma.role.create({ data: { user_role: roleName } }); // ✅ changed db to prisma
      console.log(`Created role: ${roleName}`);
    }
  }

  // 2. Create Statuses (General usage)
  const statuses = ['Active', 'Inactive', 'Suspended'];
  for (const statusName of statuses) {
    const exists = await prisma.status.findFirst({ where: { ststus: statusName } }); 
    if (!exists) {
      await prisma.status.create({ data: { ststus: statusName } }); // ✅ changed db to prisma
      console.log(`Created status: ${statusName}`);
    }
  }

  // 3. Create Users
  const adminRole = await prisma.role.findFirst({ where: { user_role: 'Admin' } });
  const activeStatus = await prisma.status.findFirst({ where: { ststus: 'Active' } });

  if (adminRole && activeStatus) {
    const passwordHash = await bcrypt.hash('123456', 10);
    const adminUser = await prisma.user.findUnique({ where: { id: 1 } });
    
    if (!adminUser) {
      await prisma.user.create({ // ✅ changed db to prisma
        data: {
          id: 1,
          name: 'Super Admin',
          contact: '0771234567',
          email: 'admin@reox.com',
          password: passwordHash,
          role_id: adminRole.id,
          status_id: activeStatus.id,
          created_at: new Date()
        }
      });
      console.log('Created admin user');
    }
  }

  // 4. Create Product Metadata
  const categories = ['Electronics', 'Clothing', 'Groceries'];
  for (const name of categories) {
    const exists = await prisma.category.findFirst({ where: { name } });
    if (!exists) await prisma.category.create({ data: { name } }); // ✅ changed db to prisma
  }

  const brands = ['Nike', 'Samsung', 'Keells'];
  for (const name of brands) {
    const exists = await prisma.brand.findFirst({ where: { name } });
    if (!exists) await prisma.brand.create({ data: { name } }); // ✅ changed db to prisma
  }

  const units = ['PCS', 'KG', 'L'];
  for (const name of units) {
    const exists = await prisma.unit_id.findFirst({ where: { name } });
    if (!exists) await prisma.unit_id.create({ data: { name } }); // ✅ changed db to prisma
  }

  const pTypes = ['Standard', 'Weighted', 'Service'];
  for (const name of pTypes) {
    const exists = await prisma.product_type.findFirst({ where: { name } });
    if (!exists) await prisma.product_type.create({ data: { name } }); // ✅ changed db to prisma
  }

  const pStatuses = ['Available', 'Out of Stock', 'Discontinued'];
  for (const status_name of pStatuses) {
    const exists = await prisma.product_status.findFirst({ where: { status_name } });
    if (!exists) await prisma.product_status.create({ data: { status_name } }); // ✅ changed db to prisma
  }

  // 5. Create Sample Product
  const category = await prisma.category.findFirst();
  const brand = await prisma.brand.findFirst();
  const unit = await prisma.unit_id.findFirst();
  const pType = await prisma.product_type.findFirst();
  const pStatus = await prisma.product_status.findFirst();

  if (category && brand && unit && pType && pStatus) {
    const productCode = 'P001';
    const existingProduct = await prisma.product.findUnique({ where: { product_code: productCode } });

    if (!existingProduct) {
      const newProduct = await prisma.product.create({ // ✅ changed db to prisma
        data: {
          product_name: 'Sample T-Shirt',
          product_code: productCode,
          category_id: category.idcategory,
          brand_id: brand.idbrand,
          unit_id: unit.idunit_id,
          product_type_id: pType.idproduct_type
        }
      });

      await prisma.product_variations.create({ // ✅ changed db to prisma
        data: {
          product_id: newProduct.id,
          barcode: '1234567890123',
          color: 'Red',
          size: 'L',
          storage_capacity: 'N/A',
          product_status_id: pStatus.idproduct_status
        }
      });

      await prisma.product_variations.create({ // ✅ changed db to prisma
        data: {
          product_id: newProduct.id,
          barcode: '1234567890124',
          color: 'Blue',
          size: 'M',
          storage_capacity: 'N/A',
          product_status_id: pStatus.idproduct_status
        }
      });
      console.log(`Created product: ${newProduct.product_name}`);
    }
  }

  // 6. Cash Session Setup
  const cashStatuses = ['Open', 'Closed', 'Paused'];
  for (const cash_status of cashStatuses) {
    const exists = await prisma.cash_status.findFirst({ where: { cash_status } });
    if (!exists) await prisma.cash_status.create({ data: { cash_status } }); // ✅ changed db to prisma
  }

  const counters = ['Counter 1', 'Counter 2'];
  for (const cashier_counter of counters) {
    const exists = await prisma.cashier_counters.findFirst({ where: { cashier_counter } });
    if (!exists) await prisma.cashier_counters.create({ data: { cashier_counter } }); // ✅ changed db to prisma
  }

  // 7. Payment Types
  const paymentTypes = ['Cash', 'Card', 'Cheque', 'Online', 'Bank'];
  for (const pType of paymentTypes) {
    const exists = await prisma.payment_types.findFirst({ where: { payment_types: pType } });
    if (!exists) {
      await prisma.payment_types.create({ data: { payment_types: pType } }); // ✅ changed db to prisma
      console.log(`Created payment type: ${pType}`);
    }
  }

  // 8. Invoice Types
  const invoiceTypes = ['Sales', 'Return'];
  for (const iType of invoiceTypes) {
     const exists = await prisma.invoice_type.findFirst({ where: { Invoice_type: iType } });
     if (!exists) {
       await prisma.invoice_type.create({ data: { Invoice_type: iType } }); // ✅ changed db to prisma
       console.log(`Created invoice type: ${iType}`);
     }
  }

  // 9. Exchange Types
  const exchangeTypes = [
    { id: 1, name: 'Cash In' },
    { id: 2, name: 'Cash Out' }
  ];
  for (const item of exchangeTypes) {
    const exists = await prisma.exchange_type.findUnique({ where: { id: item.id } });
    if (!exists) {
      await prisma.exchange_type.create({ data: { id: item.id, exchange_type: item.name } }); // ✅ changed db to prisma
      console.log(`Created exchange type: ${item.name}`);
    }
  }

  // 10. Return Statuses
  const returnStatuses = ['Pending', 'Completed', 'Rejected', 'Pending Review', 'Confirmed', 'Disposed', 'Returned to Supplier'];
  for (const rs of returnStatuses) {
     const exists = await prisma.return_status.findFirst({ where: { return_status: rs } });
     if (!exists) {
       await prisma.return_status.create({ data: { return_status: rs } }); // ✅ changed db to prisma
       console.log(`Created return status: ${rs}`);
     }
  }

  // 11. Reasons
  const reasons = [
    'Transit damage', 'Handling damage', 'Packaging defect', 'Manufacturing defect',
    'Expired product', 'Customer return', 'Improper storage', 'Supplier damage',
    'Water damage', 'Theft damage'
  ];
  for (const reasonText of reasons) {
    const exists = await prisma.reason.findFirst({ where: { reason: reasonText } });
    if (!exists) {
      await prisma.reason.create({ data: { reason: reasonText } }); // ✅ changed db to prisma
      console.log(`Created reason: ${reasonText}`);
    }
  }

  // 12. Banks
  const banks = [
    'Bank of Ceylon (BOC)', "People's Bank", 'National Savings Bank (NSB)',
    'Commercial Bank of Ceylon', 'Hatton National Bank (HNB)', 'Sampath Bank',
    'Seylan Bank', 'Nations Trust Bank (NTB)', 'DFCC Bank', 'NDB Bank',
    'Pan Asia Bank', 'Amana Bank', 'Union Bank', 'Cargills Bank',
    'SDB Bank (Sanasa Development Bank)', 'Regional Development Bank (RDB)',
    'HDFC Bank', 'State Mortgage & Investment Bank (SMIB)', 'HSBC', 'Standard Chartered Bank'
  ];
  for (const bankName of banks) {
    const exists = await prisma.bank.findFirst({ where: { bank_name: bankName } });
    if (!exists) {
      await prisma.bank.create({ data: { bank_name: bankName } }); // ✅ changed db to prisma
      console.log(`Created bank: ${bankName}`);
    }
  }

  console.log('✅ Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });