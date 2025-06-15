import { db } from "@/db";
import { users } from "@/schema";
import { reset } from "drizzle-seed";

await reset(db, {
	users,
});
