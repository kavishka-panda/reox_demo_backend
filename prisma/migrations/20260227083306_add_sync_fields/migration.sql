/*
  Warnings:

  - You are about to drop the column `updated_at` on the `category` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `invoice` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `invoice_items` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `stock` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `stock` table. All the data in the column will be lost.
  - You are about to drop the `unit_conversions` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `barcode` on table `stock` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `unit_conversions` DROP FOREIGN KEY `fk_unit_conversions_child`;

-- DropForeignKey
ALTER TABLE `unit_conversions` DROP FOREIGN KEY `fk_unit_conversions_parent`;

-- DropIndex
DROP INDEX `customer_contact_idx` ON `customer`;

-- DropIndex
DROP INDEX `invoice_invoice_number_idx` ON `invoice`;

-- DropIndex
DROP INDEX `product_product_name_idx` ON `product`;

-- DropIndex
DROP INDEX `product_variations_barcode_idx` ON `product_variations`;

-- DropIndex
DROP INDEX `stock_barcode_idx` ON `stock`;

-- DropIndex
DROP INDEX `stock_qty_idx` ON `stock`;

-- DropIndex
DROP INDEX `supplier_contact_number_idx` ON `supplier`;

-- AlterTable
ALTER TABLE `category` DROP COLUMN `updated_at`;

-- AlterTable
ALTER TABLE `customer` DROP COLUMN `updated_at`;

-- AlterTable
ALTER TABLE `invoice` DROP COLUMN `updated_at`;

-- AlterTable
ALTER TABLE `invoice_items` DROP COLUMN `created_at`;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `updated_at`;

-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `remarks` TEXT NULL;

-- AlterTable
ALTER TABLE `stock` DROP COLUMN `created_at`,
    DROP COLUMN `updated_at`,
    MODIFY `barcode` TEXT NOT NULL;

-- DropTable
DROP TABLE `unit_conversions`;

-- CreateTable
CREATE TABLE `credit_payment_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creadit_book_id` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `payment_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_credit_payment_history_creadit_book1_idx`(`creadit_book_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `db_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `host` VARCHAR(255) NOT NULL,
    `user` VARCHAR(100) NOT NULL,
    `password` TEXT NOT NULL,
    `database` VARCHAR(100) NOT NULL,
    `port` VARCHAR(10) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `mode` VARCHAR(20) NOT NULL DEFAULT 'offline',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `credit_payment_history` ADD CONSTRAINT `fk_credit_payment_history_creadit_book1` FOREIGN KEY (`creadit_book_id`) REFERENCES `creadit_book`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
