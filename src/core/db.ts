import {
	articleTags,
	articles,
	articlesRelations,
	favorites,
	tags,
	tagsRelations,
} from "@/articles/articles.schema";
import { follows } from "@/profiles/profiles.schema";
import { users } from "@/users/users.schema";
import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "./env";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		users,
		follows,
		articles,
		tags,
		articleTags,
		favorites,
		articlesRelations,
		tagsRelations,
	},
	logger: env.LOG_LEVEL === "debug",
});
