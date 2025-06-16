import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey(),
	email: text("email").notNull().unique(),
	username: text("username").unique().notNull(),
	bio: text("bio"),
	image: text("image"),
	password: text("password").notNull(),
});
