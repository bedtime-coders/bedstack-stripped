import { users } from "@/users/users.schema";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const follows = sqliteTable("follows", {
	followerId: integer("follower_id")
		.notNull()
		.references(() => users.id),
	followingId: integer("following_id")
		.notNull()
		.references(() => users.id),
});
