-- AlterTable
-- Backfill payload for any legacy null events
UPDATE `sync_outbox`
SET `payload` = JSON_OBJECT()
WHERE `payload` IS NULL;

-- AlterTable
ALTER TABLE `sync_outbox`
    MODIFY COLUMN `table_name` VARCHAR(191) NOT NULL,
    MODIFY COLUMN `record_id` VARCHAR(191) NOT NULL,
    MODIFY COLUMN `action` VARCHAR(45) NOT NULL,
    MODIFY COLUMN `payload` JSON NOT NULL,
    ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0,
    ADD COLUMN `last_error` TEXT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

CREATE INDEX `idx_sync_outbox_action_status` ON `sync_outbox`(`action`, `status`);