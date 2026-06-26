-- CreateTable
CREATE TABLE `sync_outbox` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `table_name` VARCHAR(100) NOT NULL,
    `record_id` VARCHAR(100) NOT NULL,
    `action` VARCHAR(10) NOT NULL,
    `payload` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `idx_sync_outbox_status_created_at` (`status`, `created_at`),
    INDEX `idx_sync_outbox_table_record` (`table_name`, `record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
