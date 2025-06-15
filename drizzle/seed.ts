import { exit } from "node:process";
import { parseArgs } from "node:util";
import { db } from "@/db";
import { users } from "@/schema";
import { reset, seed } from "drizzle-seed";

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		reset: { type: "boolean", default: false },
	},
	strict: true,
	allowPositionals: true,
});

if (values.reset) {
	const nodeEnv = process.env.NODE_ENV;
	if (!nodeEnv || !["development", "test"].includes(nodeEnv)) {
		console.error(
			"❌ Database reset is only allowed in development or test environments.",
		);
		console.error("Current NODE_ENV:", nodeEnv || "not set");
		exit(1);
	}

	console.log("🔄 Resetting database...");
	await reset(db, {
		users,
	});
}

await seed(db, {
	users,
});

exit(0);
