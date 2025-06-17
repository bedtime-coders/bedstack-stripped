import { exit } from "node:process";
import { parseArgs } from "node:util";
import { env } from "@/core/env";
import { follows } from "@/profiles/profiles.schema";
import { users } from "@/users/users.schema";
import chalk from "chalk";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { reset, seed } from "drizzle-seed";
import { draw } from "radashi";

const schema = {
	users,
	follows,
};

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
	console.log(chalk.gray("Resetting database"));
	await reset(db, schema);
	console.log(`[${chalk.green("✓")}] Database reset complete`);
}

console.log(chalk.gray("Seeding database"));

// Auto seeding

await seed(db, schema).refine((f) => ({
	users: {
		count: 10,
	},
	follows: {
		count: 0,
	},
}));

// Manual seeding

const userIds = await db.select({ id: users.id }).from(users);

const followsData = new Set<string>();
const followRows = [];

while (followRows.length < 20) {
	const follower = draw(userIds);
	const following = draw(userIds);

	if (!follower || !following) {
		continue;
	}

	if (follower.id !== following.id) {
		const key = `${follower.id}-${following.id}`;
		if (!followsData.has(key)) {
			followsData.add(key);
			followRows.push({ followerId: follower.id, followingId: following.id });
		}
	}
}

await db.insert(follows).values(followRows);

console.log(`[${chalk.green("✓")}] Database seeded`);

exit(0);
