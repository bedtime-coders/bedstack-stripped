import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/users/users.schema";

/**
 * Junction table for many-to-many relationship between users (following/followers)
 * This implements the users-to-users relationship through the follows table
 */
export const follows = pgTable(
	"follows",
	{
		followerId: uuid("follower_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		followedId: uuid("followed_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		// Primary key on both foreign key columns
		primaryKey({ columns: [table.followerId, table.followedId] }),
		// Individual indexes for single-side queries
		index("follows_follower_id_idx").on(table.followerId),
		index("follows_followed_id_idx").on(table.followedId),
		// Composite index for efficient many-to-many relationship queries
		index("follows_follower_followed_idx").on(
			table.followerId,
			table.followedId,
		),
		// Prevent self-following
		check(
			"unique_follower_following",
			sql`${table.followerId} != ${table.followedId}`,
		),
	],
);
