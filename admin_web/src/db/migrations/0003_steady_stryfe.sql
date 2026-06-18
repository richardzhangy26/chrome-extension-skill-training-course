CREATE INDEX `payment_user_paid_idx` ON `payment` (`user_id`,`paid`);--> statement-breakpoint
CREATE INDEX `user_files_user_id_idx` ON `user_files` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_files_r2_key_idx` ON `user_files` (`r2_key`);