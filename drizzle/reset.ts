import { db } from "@/db";
import { users } from "@/schema";

await db.delete(users);
