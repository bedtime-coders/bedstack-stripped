import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey(),
	email: text("email").notNull().unique(),
	username: text("username").unique().notNull(),
	bio: text("bio"),
	image: text("image"),
	password: text("password").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(new Date())
		.$onUpdate(() => new Date()),
});
