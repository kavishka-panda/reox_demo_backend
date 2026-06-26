/*
  Warnings:

  - You are about to drop the column `amount` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `due_date` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `is_paid` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `last_payment_date` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `bank` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `batch` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `brand` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `cash_sessions` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `cash_status` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `cashier_counters` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `category` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `company` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `creadit_book` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `credit_payment_history` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `customer` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `damaged` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `exchange_type` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `grn` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `grn_items` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `grn_payments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `invoice` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `invoice_items` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `invoice_payments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `invoice_type` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `money_exchange` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `payment_types` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `product` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `product_status` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `product_type` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `product_variations` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `quotation` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `quotation_items` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `reason` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `return` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `return_goods` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `return_status` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `role` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `status` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `stock` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `subscription` DROP COLUMN `amount`,
    DROP COLUMN `due_date`,
    DROP COLUMN `is_paid`,
    DROP COLUMN `last_payment_date`,
    DROP COLUMN `status`,
    ADD COLUMN `expiry_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    ADD COLUMN `is_active` VARCHAR(10) NOT NULL DEFAULT 'active',
    ADD COLUMN `last_checked_at` DATETIME(0) NULL,
    ADD COLUMN `license_key` VARCHAR(255) NOT NULL DEFAULT 'UNASSIGNED';

-- AlterTable
ALTER TABLE `supplier` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `unit_id` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
