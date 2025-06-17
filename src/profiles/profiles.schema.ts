import { users } from "@/users/users.schema";
import { sql } from "drizzle-orm";
import {
	check,
	integer,
	primaryKey,
	sqliteTable,
} from "drizzle-orm/sqlite-core";

export const follows = sqliteTable(
	"follows",
	{
		followerId: integer("follower_id")
			.notNull()
			.references(() => users.id),
		followingId: integer("following_id")
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch('subsec') * 1000)`),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch('subsec') * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followingId] }),
		check(
			"unique_follower_following",
			sql`${table.followerId} != ${table.followingId}`,
		),
	],
);
