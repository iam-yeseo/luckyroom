CREATE TABLE `game_action_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `profiles`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rps_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`match_type` integer NOT NULL,
	`wins_required` integer NOT NULL,
	`player_bet` integer NOT NULL,
	`ai_bet` integer NOT NULL,
	`player_wins` integer DEFAULT 0 NOT NULL,
	`ai_wins` integer DEFAULT 0 NOT NULL,
	`decisive_rounds` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`ai_move` text NOT NULL,
	`history_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`winner` text,
	`payout` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_email`) REFERENCES `profiles`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rps_matches_active_user_idx` ON `rps_matches` (`user_email`) WHERE "rps_matches"."status" = 'active';--> statement-breakpoint
CREATE TABLE `timing_games` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`target_hundredths` integer NOT NULL,
	`bet_amount` integer NOT NULL,
	`failure_count` integer NOT NULL,
	`multiplier_tenths` integer NOT NULL,
	`started_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`elapsed_hundredths` integer,
	`success` integer,
	`payout` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `profiles`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timing_games_active_user_idx` ON `timing_games` (`user_email`) WHERE "timing_games"."status" = 'active';--> statement-breakpoint
CREATE TABLE `timing_stats` (
	`user_email` text PRIMARY KEY NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `profiles`(`email`) ON UPDATE no action ON DELETE no action
);
