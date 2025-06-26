import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { articles } from "@/articles/articles.schema";
import { comments } from "@/comments/comments.schema";
import { follows } from "@/profiles/profiles.schema";

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: text("email").notNull().unique(),
	username: text("username").unique().notNull(),
	bio: text("bio"),
	image: text("image"),
	password: text("password").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
	followers: many(follows, {
		relationName: "followers", // users that follow this user
	}),
	following: many(follows, {
		relationName: "following", // users that this user is following
	}),
	comments: many(comments),
	articles: many(articles),
}));
