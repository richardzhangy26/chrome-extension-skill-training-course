CREATE TABLE `user_agent_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`session` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_agent_log_user_session_idx` ON `user_agent_log` (`user_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `user_agent_log_user_id_idx` ON `user_agent_log` (`user_id`);