-- CreateTable
CREATE TABLE `bank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bank_name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `batch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batch_name` VARCHAR(45) NOT NULL,
    `date_time` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brand` (
    `idbrand` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idbrand`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `opening_date_time` DATETIME(0) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `opening_balance` DOUBLE NOT NULL,
    `cash_total` DOUBLE NOT NULL,
    `card_total` DOUBLE NOT NULL,
    `bank_total` DOUBLE NOT NULL,
    `cashier_counters_id` INTEGER NOT NULL,
    `cash_status_id` INTEGER NOT NULL,

    INDEX `fk_cash_sessions_cash_status1_idx`(`cash_status_id`),
    INDEX `fk_cash_sessions_cashier_counters1_idx`(`cashier_counters_id`),
    INDEX `fk_cash_sessions_user1_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cash_status` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashier_counters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashier_counter` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category` (
    `idcategory` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idcategory`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(100) NOT NULL,
    `company_email` VARCHAR(100) NULL,
    `company_contact` VARCHAR(45) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `company_name_UNIQUE`(`company_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `creadit_book` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `balance` DOUBLE NOT NULL,
    `status_id` INTEGER NOT NULL,
    `created_at` DATE NOT NULL,

    INDEX `fk_creadit_book_invoice1_idx`(`invoice_id`),
    INDEX `fk_creadit_book_status1_idx`(`status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `email` VARCHAR(45) NULL,
    `credit_balance` VARCHAR(45) NULL,
    `status_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_customer_status1_idx1`(`status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `damaged` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_id` INTEGER NOT NULL,
    `qty` DOUBLE NOT NULL,
    `reason_id` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `date` DATE NOT NULL,
    `return_status_id` INTEGER NOT NULL,

    INDEX `fk_damaged_return_status1_idx`(`return_status_id`),
    INDEX `fk_return_reason1_idx`(`reason_id`),
    INDEX `fk_return_stock1_idx`(`stock_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exchange_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exchange_type` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bill_number` VARCHAR(45) NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `total` DOUBLE NOT NULL,
    `paid_amount` DOUBLE NOT NULL,
    `balance` DOUBLE NOT NULL,
    `grn_status_id` INTEGER NOT NULL,
    `create_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_grn_grn_status1_idx`(`grn_status_id`),
    INDEX `fk_grn_supplier1_idx`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grn_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_id` INTEGER NOT NULL,
    `stock_id` INTEGER NOT NULL,
    `qty` DOUBLE NOT NULL,
    `free_qty` DOUBLE NULL,

    INDEX `fk_grn_items_grn1_idx`(`grn_id`),
    INDEX `fk_grn_items_stock1_idx`(`stock_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grn_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paid_amount` DOUBLE NOT NULL,
    `payment_types_id` INTEGER NOT NULL,
    `grn_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_grn_payments_grn1_idx`(`grn_id`),
    INDEX `fk_grn_payments_payment_types1_idx`(`payment_types_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(45) NOT NULL,
    `customer_id` INTEGER NULL,
    `sub_total` DOUBLE NOT NULL,
    `discount` DOUBLE NOT NULL,
    `extra_discount` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `created_at` DATE NOT NULL,
    `cash_sessions_id` INTEGER NOT NULL,
    `invoice_type_id` INTEGER NOT NULL,

    INDEX `fk_invoice_cash_sessions1_idx`(`cash_sessions_id`),
    INDEX `fk_invoice_customer1_idx`(`customer_id`),
    INDEX `fk_invoice_invoice_type1_idx1`(`invoice_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_id` INTEGER NOT NULL,
    `invoice_id` INTEGER NOT NULL,
    `current_price` DOUBLE NOT NULL,
    `discount_percentage` DOUBLE NOT NULL,
    `discount_amount` DOUBLE NOT NULL,
    `qty` DOUBLE NOT NULL,

    INDEX `fk_inoice_items_invoice1_idx`(`invoice_id`),
    INDEX `fk_inoice_items_stock1_idx`(`stock_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `Invoice_type` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `money_exchange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cash_sessions_id` INTEGER NOT NULL,
    `exchange_type_id1` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` TEXT NOT NULL,
    `datetime` DATETIME(0) NOT NULL,

    INDEX `fk_money_exchange_cash_sessions1_idx`(`cash_sessions_id`),
    INDEX `fk_money_exchange_exchange_type1_idx1`(`exchange_type_id1`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_types` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_name` VARCHAR(255) NOT NULL,
    `product_code` VARCHAR(100) NOT NULL,
    `category_id` INTEGER NOT NULL,
    `brand_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `product_type_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `product_code_UNIQUE`(`product_code`),
    INDEX `fk_product_brand1_idx`(`brand_id`),
    INDEX `fk_product_category_idx`(`category_id`),
    INDEX `fk_product_product_type1_idx`(`product_type_id`),
    INDEX `fk_product_unit_id1_idx`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_status` (
    `idproduct_status` INTEGER NOT NULL AUTO_INCREMENT,
    `status_name` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`idproduct_status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_type` (
    `idproduct_type` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(45) NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idproduct_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `barcode` VARCHAR(255) NOT NULL,
    `color` VARCHAR(45) NULL,
    `size` VARCHAR(45) NULL,
    `storage_capacity` VARCHAR(45) NULL,
    `product_status_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_product_variations_product1_idx`(`product_id`),
    INDEX `fk_product_variations_product_status1_idx`(`product_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reason` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reason` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `damaged_id` INTEGER NOT NULL,
    `qty` DOUBLE NOT NULL,
    `date` DATETIME(0) NOT NULL,

    INDEX `fk_return_damaged1_idx`(`damaged_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_goods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `cash_sessions_id` INTEGER NOT NULL,
    `balance` DOUBLE NOT NULL,

    INDEX `fk_return_goods_cash_sessions1_idx`(`cash_sessions_id`),
    INDEX `fk_return_goods_invoice1_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `return_status` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_role` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ststus` VARCHAR(45) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_variations_id` INTEGER NOT NULL,
    `barcode` TEXT NOT NULL,
    `batch_id` INTEGER NOT NULL,
    `mfd` DATE NULL,
    `exp` DATE NULL,
    `cost_price` DOUBLE NOT NULL,
    `mrp` DOUBLE NOT NULL,
    `rsp` DOUBLE NOT NULL,
    `wsp` DOUBLE NULL,
    `qty` DOUBLE NOT NULL,
    `free_qty` DOUBLE NULL,

    INDEX `fk_stock_batch1_idx`(`batch_id`),
    INDEX `fk_stock_product_variations1_idx`(`product_variations_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(200) NULL,
    `contact_number` VARCHAR(10) NOT NULL,
    `company_id` INTEGER NOT NULL,
    `bank_id` INTEGER NULL,
    `account_number` VARCHAR(45) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status_id` INTEGER NOT NULL,

    INDEX `fk_supplier_bank1_idx`(`bank_id`),
    INDEX `fk_supplier_company1_idx`(`company_id`),
    INDEX `fk_supplier_status1_idx1`(`status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_id` (
    `idunit_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idunit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `email` VARCHAR(100) NULL,
    `password` VARCHAR(100) NOT NULL,
    `role_id` INTEGER NOT NULL,
    `created_at` DATE NOT NULL,
    `status_id` INTEGER NOT NULL,

    INDEX `fk_user_role1_idx`(`role_id`),
    INDEX `fk_user_status1_idx`(`status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `fk_cash_sessions_cash_status1` FOREIGN KEY (`cash_status_id`) REFERENCES `cash_status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `fk_cash_sessions_cashier_counters1` FOREIGN KEY (`cashier_counters_id`) REFERENCES `cashier_counters`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `fk_cash_sessions_user1` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `creadit_book` ADD CONSTRAINT `fk_creadit_book_invoice1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `creadit_book` ADD CONSTRAINT `fk_creadit_book_status1` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `fk_customer_status1` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `damaged` ADD CONSTRAINT `fk_damaged_return_status1` FOREIGN KEY (`return_status_id`) REFERENCES `return_status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `damaged` ADD CONSTRAINT `fk_return_reason1` FOREIGN KEY (`reason_id`) REFERENCES `reason`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `damaged` ADD CONSTRAINT `fk_return_stock1` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn` ADD CONSTRAINT `fk_grn_grn_status1` FOREIGN KEY (`grn_status_id`) REFERENCES `status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn` ADD CONSTRAINT `fk_grn_supplier1` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_items_grn1` FOREIGN KEY (`grn_id`) REFERENCES `grn`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_items_stock1` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_payments` ADD CONSTRAINT `fk_grn_payments_grn1` FOREIGN KEY (`grn_id`) REFERENCES `grn`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_payments` ADD CONSTRAINT `fk_grn_payments_payment_types1` FOREIGN KEY (`payment_types_id`) REFERENCES `payment_types`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `fk_invoice_customer1` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `fk_invoice_invoice_type1` FOREIGN KEY (`invoice_type_id`) REFERENCES `invoice_type`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `fk_inoice_items_invoice1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `fk_inoice_items_stock1` FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `money_exchange` ADD CONSTRAINT `fk_money_exchange_cash_sessions1` FOREIGN KEY (`cash_sessions_id`) REFERENCES `cash_sessions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `money_exchange` ADD CONSTRAINT `fk_money_exchange_exchange_type1` FOREIGN KEY (`exchange_type_id1`) REFERENCES `exchange_type`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `fk_product_brand1` FOREIGN KEY (`brand_id`) REFERENCES `brand`(`idbrand`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `fk_product_category` FOREIGN KEY (`category_id`) REFERENCES `category`(`idcategory`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `fk_product_product_type1` FOREIGN KEY (`product_type_id`) REFERENCES `product_type`(`idproduct_type`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `fk_product_unit_id1` FOREIGN KEY (`unit_id`) REFERENCES `unit_id`(`idunit_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product_variations` ADD CONSTRAINT `fk_product_variations_product1` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `product_variations` ADD CONSTRAINT `fk_product_variations_product_status1` FOREIGN KEY (`product_status_id`) REFERENCES `product_status`(`idproduct_status`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `return_goods` ADD CONSTRAINT `fk_return_goods_cash_sessions1` FOREIGN KEY (`cash_sessions_id`) REFERENCES `cash_sessions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `return_goods` ADD CONSTRAINT `fk_return_goods_invoice1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock` ADD CONSTRAINT `fk_stock_batch1` FOREIGN KEY (`batch_id`) REFERENCES `batch`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock` ADD CONSTRAINT `fk_stock_product_variations1` FOREIGN KEY (`product_variations_id`) REFERENCES `product_variations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `fk_supplier_bank1` FOREIGN KEY (`bank_id`) REFERENCES `bank`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `fk_supplier_company1` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `fk_supplier_status1` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `fk_user_role1` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `fk_user_status1` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
