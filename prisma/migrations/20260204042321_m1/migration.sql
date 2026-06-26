/*
  Warnings:

  - You are about to drop the column `credit_balance` on the `customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `category` ADD COLUMN `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `creadit_book` MODIFY `created_at` DATETIME(0) NOT NULL;

-- AlterTable
ALTER TABLE `customer` DROP COLUMN `credit_balance`,
    ADD COLUMN `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `invoice` ADD COLUMN `refunded_amount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `created_at` DATETIME(0) NOT NULL;

-- AlterTable
ALTER TABLE `invoice_items` ADD COLUMN `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    ADD COLUMN `returned_qty` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `stock` ADD COLUMN `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    ADD COLUMN `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `barcode` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `invoice_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `payment_types_id` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `payment_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_invoice_payments_invoice1_idx`(`invoice_id`),
    INDEX `fk_invoice_payments_payment_types1_idx`(`payment_types_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_conversions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_unit_id` INTEGER NOT NULL,
    `child_unit_id` INTEGER NOT NULL,
    `conversion_factor` FLOAT NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_unit_conversions_parent_idx`(`parent_unit_id`),
    INDEX `fk_unit_conversions_child_idx`(`child_unit_id`),
    UNIQUE INDEX `unique_parent_child`(`parent_unit_id`, `child_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_number` VARCHAR(45) NOT NULL,
    `customer_id` INTEGER NULL,
    `sub_total` DOUBLE NOT NULL,
    `discount` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `valid_until` DATE NOT NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `quotation_customer_id_idx`(`customer_id`),
    INDEX `quotation_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_id` INTEGER NOT NULL,
    `stock_id` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `discount_amount` DOUBLE NOT NULL,
    `qty` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,

    INDEX `quotation_items_quotation_id_idx`(`quotation_id`),
    INDEX `quotation_items_stock_id_idx`(`stock_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `due_date` DATETIME(0) NOT NULL,
    `status` VARCHAR(45) NOT NULL,
    `is_paid` BOOLEAN NOT NULL DEFAULT false,
    `last_payment_date` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `customer_contact_idx` ON `customer`(`contact`);

-- CreateIndex
CREATE INDEX `invoice_invoice_number_idx` ON `invoice`(`invoice_number`);

-- CreateIndex
CREATE INDEX `product_product_name_idx` ON `product`(`product_name`);

-- CreateIndex
CREATE INDEX `product_variations_barcode_idx` ON `product_variations`(`barcode`);

-- CreateIndex
CREATE INDEX `stock_barcode_idx` ON `stock`(`barcode`);

-- CreateIndex
CREATE INDEX `stock_qty_idx` ON `stock`(`qty`);

-- CreateIndex
CREATE INDEX `supplier_contact_number_idx` ON `supplier`(`contact_number`);

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `fk_invoice_cash_sessions1` FOREIGN KEY (`cash_sessions_id`) REFERENCES `cash_sessions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invoice_payments` ADD CONSTRAINT `fk_invoice_payments_invoice1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invoice_payments` ADD CONSTRAINT `fk_invoice_payments_payment_types1` FOREIGN KEY (`payment_types_id`) REFERENCES `payment_types`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `unit_conversions` ADD CONSTRAINT `fk_unit_conversions_parent` FOREIGN KEY (`parent_unit_id`) REFERENCES `unit_id`(`idunit_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `unit_conversions` ADD CONSTRAINT `fk_unit_conversions_child` FOREIGN KEY (`child_unit_id`) REFERENCES `unit_id`(`idunit_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation` ADD CONSTRAINT `quotation_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation` ADD CONSTRAINT `quotation_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
