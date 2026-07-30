CREATE TABLE `coin_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `profiles`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`user_email` text NOT NULL,
	`symbol` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`average_price` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_email`, `symbol`),
	FOREIGN KEY (`user_email`) REFERENCES `profiles`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `market_state` (
	`symbol` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`underlying` text,
	`multiplier` integer DEFAULT 1 NOT NULL,
	`inverse` integer DEFAULT false NOT NULL,
	`price` integer NOT NULL,
	`previous_price` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`phase_started_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_boards` (
	`id` integer PRIMARY KEY NOT NULL,
	`generation` integer NOT NULL,
	`cells_json` text NOT NULL,
	`remaining` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`balance` integer DEFAULT 1000000 NOT NULL,
	`saved_luck` integer DEFAULT 0 NOT NULL,
	`last_earn_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
