import { env } from "@/core/env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/**/*.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
});
