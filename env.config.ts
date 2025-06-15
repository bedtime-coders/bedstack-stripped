// TODO: switch to elysia-env

import { t } from "elysia";
import { parseEnv } from "typebox-env";

export default parseEnv(
	t.Object({
		DATABASE_URL: t.String(),
		JWT_SECRET: t.String(),
		PORT: t.Number({
			default: 3000,
		}),
	}),
	process.env,
);
