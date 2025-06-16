import { env as elysiaEnv } from "@yolk-oss/elysia-env";
import { t } from "elysia";

export const envPlugin = elysiaEnv({
	DATABASE_URL: t.String(),
	PORT: t.Number({
		min: 1,
		max: 65535,
		default: 3000,
	}),
	JWT_SECRET: t.String(),
	NODE_ENV: t.Union(
		[t.Literal("development"), t.Literal("production"), t.Literal("test")],
		{
			default: "development",
		},
	),
});

export const { env } = envPlugin.decorator;
