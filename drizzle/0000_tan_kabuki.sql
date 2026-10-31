CREATE TABLE `rabbit_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`variant` text NOT NULL,
	`room_id` text DEFAULT 'main' NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`z` real DEFAULT 10 NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'walking' NOT NULL,
	`seat_id` text,
	`tea` text,
	`teaware` text,
	`ritual` text DEFAULT 'idle' NOT NULL,
	`action_started_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rabbit_sessions_room_updated_idx` ON `rabbit_sessions` (`room_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `room_seats` (
	`seat_id` text PRIMARY KEY NOT NULL,
	`room_id` text DEFAULT 'main' NOT NULL,
	`session_id` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_seats_session_idx` ON `room_seats` (`session_id`);