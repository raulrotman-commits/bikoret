CREATE TABLE `bk_findings` (
	`id` varchar(36) NOT NULL,
	`visit_id` varchar(36) NOT NULL,
	`user_id` int NOT NULL,
	`catalog_id` int,
	`custom_title` text,
	`custom_reg` varchar(40),
	`custom_reg_no` varchar(40),
	`location` varchar(200) NOT NULL DEFAULT '',
	`note` text,
	`likelihood` tinyint,
	`severity` tinyint,
	`work_stopped` boolean NOT NULL DEFAULT false,
	`deadline_days` int,
	`carried_from_id` varchar(36),
	`recurring` boolean NOT NULL DEFAULT false,
	`follow_status` enum('open','fixed'),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `bk_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bk_password_resets` (
	`token` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	CONSTRAINT `bk_password_resets_token` PRIMARY KEY(`token`)
);
--> statement-breakpoint
CREATE TABLE `bk_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`low_profile_id` varchar(64) NOT NULL,
	`plan` varchar(20) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
	`raw` text,
	`created_at` datetime NOT NULL,
	`paid_at` datetime,
	CONSTRAINT `bk_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `bk_payments_lp` UNIQUE(`low_profile_id`)
);
--> statement-breakpoint
CREATE TABLE `bk_photos` (
	`id` varchar(36) NOT NULL,
	`finding_id` varchar(36) NOT NULL,
	`visit_id` varchar(36) NOT NULL,
	`user_id` int NOT NULL,
	`storage_key` varchar(255) NOT NULL,
	`content_type` varchar(60) NOT NULL DEFAULT 'image/jpeg',
	`bytes` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `bk_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bk_sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`address` varchar(255) NOT NULL DEFAULT '',
	`client` varchar(200) NOT NULL DEFAULT '',
	`contractor` varchar(200) NOT NULL DEFAULT '',
	`work_manager` varchar(120) NOT NULL DEFAULT '',
	`site_manager` varchar(120) NOT NULL DEFAULT '',
	`safety_officer` varchar(120) NOT NULL DEFAULT '',
	`unacceptable_from` tinyint NOT NULL DEFAULT 12,
	`approval_from` tinyint NOT NULL DEFAULT 4,
	`notes` text,
	`archived` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `bk_sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bk_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(120) NOT NULL DEFAULT '',
	`phone` varchar(40) NOT NULL DEFAULT '',
	`author_role` varchar(40) NOT NULL DEFAULT 'ממונה בטיחות',
	`license_no` varchar(60) NOT NULL DEFAULT '',
	`company_name` varchar(160) NOT NULL DEFAULT '',
	`company_phone` varchar(40) NOT NULL DEFAULT '',
	`company_email` varchar(160) NOT NULL DEFAULT '',
	`brand_color` varchar(9) NOT NULL DEFAULT '#0D2153',
	`logo_key` varchar(255),
	`trial_ends_at` datetime NOT NULL,
	`paid_until` datetime,
	`plan` varchar(20),
	`is_admin` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	CONSTRAINT `bk_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `bk_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `bk_visits` (
	`id` varchar(36) NOT NULL,
	`user_id` int NOT NULL,
	`site_id` int NOT NULL,
	`visit_date` date NOT NULL,
	`author_name` varchar(120) NOT NULL DEFAULT '',
	`author_role` varchar(40) NOT NULL DEFAULT '',
	`author_license` varchar(60) NOT NULL DEFAULT '',
	`contractor_rep_name` varchar(120) NOT NULL DEFAULT '',
	`contractor_rep_role` varchar(80) NOT NULL DEFAULT '',
	`recipients` text,
	`general_notes` text,
	`status` enum('draft','final') NOT NULL DEFAULT 'draft',
	`share_token` varchar(40),
	`previous_visit_id` varchar(36),
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	`finalized_at` datetime,
	CONSTRAINT `bk_visits_id` PRIMARY KEY(`id`),
	CONSTRAINT `bk_visits_share` UNIQUE(`share_token`)
);
--> statement-breakpoint
CREATE INDEX `bk_findings_visit` ON `bk_findings` (`visit_id`);--> statement-breakpoint
CREATE INDEX `bk_photos_finding` ON `bk_photos` (`finding_id`);--> statement-breakpoint
CREATE INDEX `bk_photos_visit` ON `bk_photos` (`visit_id`);--> statement-breakpoint
CREATE INDEX `bk_sites_user` ON `bk_sites` (`user_id`);--> statement-breakpoint
CREATE INDEX `bk_visits_user` ON `bk_visits` (`user_id`);--> statement-breakpoint
CREATE INDEX `bk_visits_site` ON `bk_visits` (`site_id`);