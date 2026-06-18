CREATE TABLE `payment` (
	`id` text PRIMARY KEY NOT NULL,
	`price_id` text NOT NULL,
	`user_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`subscription_id` text,
	`session_id` text,
	`invoice_id` text,
	`type` text NOT NULL,
	`scene` text,
	`interval` text,
	`status` text NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`cancel_at_period_end` integer,
	`trial_start` integer,
	`trial_end` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_invoice_id_unique` ON `payment` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payment_user_id_idx` ON `payment` (`user_id`);--> statement-breakpoint
CREATE INDEX `payment_customer_id_idx` ON `payment` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payment_subscription_id_idx` ON `payment` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `payment_session_id_idx` ON `payment` (`session_id`);--> statement-breakpoint
CREATE INDEX `payment_invoice_id_idx` ON `payment` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payment_paid_idx` ON `payment` (`paid`);--> statement-breakpoint
ALTER TABLE `user` ADD `customer_id` text;