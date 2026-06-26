/*
  Warnings:

  - Added the required column `updated_at` to the `bank` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `brand` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `cash_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `cash_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `cashier_counters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `creadit_book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `credit_payment_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `damaged` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `exchange_type` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `grn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `grn_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `grn_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `invoice_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `invoice_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `invoice_type` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `money_exchange` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `payment_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `product_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `product_type` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `product_variations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `quotation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `quotation_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `reason` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `return` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `return_goods` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `return_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `stock` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `unit_id` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `bank` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `batch` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `brand` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `cash_sessions` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `cash_status` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `cashier_counters` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `category` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `company` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `creadit_book` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `credit_payment_history` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `customer` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `damaged` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `db_config` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `exchange_type` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `grn` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `grn_items` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `grn_payments` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `invoice` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `invoice_items` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `invoice_payments` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `invoice_type` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `money_exchange` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `payment_types` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `product` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `product_status` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `product_type` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `product_variations` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `quotation_items` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `reason` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `return` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `return_goods` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `return_status` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `role` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `status` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `stock` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `subscription` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `supplier` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `unit_id` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `user` ADD COLUMN `sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);


