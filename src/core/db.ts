import { follows } from "@/profiles/profiles.schema";
import { users } from "@/users/users.schema";
import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "./env";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		users,
		follows,
	},
	logger: env.LOG_LEVEL === "debug",
});
