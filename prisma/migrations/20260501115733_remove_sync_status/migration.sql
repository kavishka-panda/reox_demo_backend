/*
  Warnings:

  - You are about to drop the column `sync_status` on the `bank` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `batch` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `brand` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `cash_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `cash_status` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `cashier_counters` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `category` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `company` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `creadit_book` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `credit_payment_history` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `damaged` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `db_config` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `exchange_type` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `grn` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `grn_items` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `grn_payments` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `invoice` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `invoice_items` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `invoice_payments` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `invoice_type` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `money_exchange` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `payment_types` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `product_status` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `product_type` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `product_variations` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `quotation` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `quotation_items` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `reason` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `return` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `return_goods` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `return_status` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `role` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `status` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `stock` table. All the data in the column will be lost.
  - The primary key for the `subscription` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `last_checked_at` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `supplier` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `unit_id` table. All the data in the column will be lost.
  - You are about to drop the column `sync_status` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `bank` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `batch` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `brand` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `cash_sessions` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `cash_status` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `cashier_counters` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `category` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `company` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `creadit_book` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `credit_payment_history` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `customer` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `damaged` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `db_config` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `exchange_type` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `grn` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `grn_items` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `grn_payments` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `invoice` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `invoice_items` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `invoice_payments` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `invoice_type` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `money_exchange` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `payment_types` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `product_status` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `product_type` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `product_variations` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `quotation` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `quotation_items` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `reason` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `return` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `return_goods` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `return_status` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `role` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `status` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `stock` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `subscription` DROP PRIMARY KEY,
    DROP COLUMN `created_at`,
    DROP COLUMN `is_active`,
    DROP COLUMN `last_checked_at`,
    DROP COLUMN `sync_status`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `db_type` VARCHAR(50) NOT NULL DEFAULT 'offline',
    ADD COLUMN `last_sync_at` DATETIME(0) NULL,
    ADD COLUMN `signature` TEXT NULL,
    ADD COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    MODIFY `id` INTEGER NOT NULL,
    MODIFY `expiry_date` DATE NOT NULL,
    ALTER COLUMN `license_key` DROP DEFAULT,
    ADD PRIMARY KEY (`license_key`);

-- AlterTable
ALTER TABLE `supplier` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `sync_outbox` MODIFY `action` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `unit_id` DROP COLUMN `sync_status`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `sync_status`;
