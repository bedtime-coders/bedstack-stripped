import { drizzle } from "drizzle-orm/bun-sql";
import {
	articles,
	articlesRelations,
	favorites,
	favoritesRelations,
} from "@/articles/articles.schema";
import { comments, commentsRelations } from "@/comments/comments.schema";
import { follows, followsRelations } from "@/profiles/profiles.schema";
import {
	articlesToTags,
	articlesToTagsRelations,
	tags,
	tagsRelations,
} from "@/tags/tags.schema";
import { users, usersRelations } from "@/users/users.schema";
import { env } from "./env";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		users,
		follows,
		articles,
		tags,
		articlesToTags,
		favorites,
		comments,
		articlesRelations,
		tagsRelations,
		articlesToTagsRelations,
		favoritesRelations,
		commentsRelations,
		followsRelations,
		usersRelations,
	},
	logger: env.LOG_LEVEL === "debug",
});
