import { db } from "@/core/db";
import { users } from "@/users/users.schema";
import chalk from "chalk";

console.log(chalk.gray("Resetting database"));
await db.delete(users);
console.log(`[${chalk.green("✓")}] Database reset complete`);
