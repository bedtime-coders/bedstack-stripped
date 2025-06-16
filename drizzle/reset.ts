import { db } from "@/db";
import { users } from "@/schema";

console.log("🔄 Resetting database...");
await db.delete(users);
console.log("✅ Database reset complete.");
