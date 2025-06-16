import { env } from "@/core/env";
import { users } from "@/users/users.schema";
import chalk from "chalk";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { reset } from "drizzle-seed";

console.log(chalk.gray("Resetting database"));
// See: https://github.com/drizzle-team/drizzle-orm/issues/3599
await reset(drizzle(env.DATABASE_URL), {
	users,
});
console.log(`[${chalk.green("✓")}] Database reset complete`);
