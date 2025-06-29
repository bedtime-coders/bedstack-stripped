import { $ } from "bun";
import chalk from "chalk";
import { sql } from "drizzle-orm";
import { db } from "@/core/database";

console.info(chalk.gray("Resetting database"));
const query = sql`
		-- Delete all tables
		DO $$ DECLARE
		    r RECORD;
		BEGIN
		    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
		        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
		    END LOOP;
		END $$;

		-- Delete enums
		DO $$ DECLARE
			r RECORD;
		BEGIN
			FOR r IN (select t.typname as enum_name
			from pg_type t
				join pg_enum e on t.oid = e.enumtypid
				join pg_catalog.pg_namespace n ON n.oid = t.typnamespace
			where n.nspname = current_schema()) LOOP
				EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.enum_name);
			END LOOP;
		END $$;
		`;

await db.execute(query);

// Push the schema to the database
await $`bun run db:push`.quiet();
console.info(`[${chalk.green("✓")}] Database reset complete`);
