import { relations, sql } from "drizzle-orm";
import {
	check,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/users/users.schema";

export const follows = pgTable(
	"follows",
	{
		followerId: uuid("follower_id")
			.notNull()
			.references(() => users.id),
		followedId: uuid("followed_id")
			.notNull()
			.references(() => users.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followedId] }),
		check(
			"unique_follower_following",
			sql`${table.followerId} != ${table.followedId}`,
		),
	],
);

export const followsRelations = relations(follows, ({ one }) => ({
	follower: one(users, {
		fields: [follows.followerId],
		references: [users.id],
		relationName: "followers", // I am the followerId in those rows
	}),
	followed: one(users, {
		fields: [follows.followedId],
		references: [users.id],
		relationName: "following", // I am the followedId in those rows
	}),
}));
