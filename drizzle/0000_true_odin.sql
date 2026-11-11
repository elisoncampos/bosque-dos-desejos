CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`player_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expiry_idx` ON `rate_limits` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `discoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`chest_id` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`notification_status` text DEFAULT 'not_configured' NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discoveries_player_chest_unique` ON `discoveries` (`player_id`,`chest_id`);
--> statement-breakpoint
CREATE INDEX `discoveries_time_idx` ON `discoveries` (`discovered_at`);
