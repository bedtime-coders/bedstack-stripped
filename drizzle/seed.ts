import { exit } from "node:process";
import { parseArgs } from "node:util";
import { env } from "@/core/env";
import { users } from "@/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { reset, seed } from "drizzle-seed";

// See: https://github.com/drizzle-team/drizzle-orm/issues/3599
const db = drizzle(env.DATABASE_URL);

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		reset: { type: "boolean", default: false },
	},
	strict: true,
	allowPositionals: true,
});

if (values.reset) {
	if (env.NODE_ENV === "production") {
		console.error(
			"❌ Database reset is only allowed in development or test environments.",
		);
		exit(1);
	}
	console.log("🔄 Resetting database...");
	await reset(db, {
		users,
	});
	console.log("✅ Database reset complete.");
}

console.log("🔄 Seeding database...");
await seed(db, {
	users,
});
console.log("✅ Database seeded.");

exit(0);
