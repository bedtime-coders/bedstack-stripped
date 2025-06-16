import { env } from "@/core/env";
import { users } from "@/users/users.schema";
import { drizzle } from "drizzle-orm/bun-sqlite";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		users,
	},
});
