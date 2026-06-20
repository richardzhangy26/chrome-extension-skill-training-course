CREATE TABLE `user_llm_config` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_llm_config_user_id_unique` ON `user_llm_config` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_llm_config_user_id_idx` ON `user_llm_config` (`user_id`);