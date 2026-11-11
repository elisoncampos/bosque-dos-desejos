CREATE TABLE `puzzle_events` (
	`player_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `puzzle_player_action_unique` ON `puzzle_events` (`player_id`,`action`);