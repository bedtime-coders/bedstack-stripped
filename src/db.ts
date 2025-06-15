import env from "@env";
import { drizzle } from "drizzle-orm/bun-sqlite";

export const db = drizzle(env.DATABASE_URL);
