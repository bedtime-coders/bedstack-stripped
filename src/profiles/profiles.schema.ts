import { users } from "@/users/users.schema";
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const follows = sqliteTable(
	"follows",
	{
		followerId: integer("follower_id")
			.notNull()
			.references(() => users.id),
		followingId: integer("following_id")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		check(
			"unique_follower_following",
			sql`${table.followerId} != ${table.followingId}`,
		),
	],
);
