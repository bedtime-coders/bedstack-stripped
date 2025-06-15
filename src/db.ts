import env from "@env";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { users } from "./schema";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		users,
	},
});
