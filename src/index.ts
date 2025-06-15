import { db } from "@/db";
import { RealWorldError } from "@/errors/realworld";
import {
	formatNotFoundError,
	formatValidationError,
	isElysiaError,
} from "@/errors/utils";
import { auth } from "@/plugins/auth";
import { users } from "@/schema";
import { swagger } from "@elysiajs/swagger";
import env from "@env";
import { Elysia, NotFoundError, ValidationError, t } from "elysia";
import { pick } from "radashi";
import { description, title } from "../package.json";
import { DEFAULT_ERROR_MESSAGE } from "./consts";

const app = new Elysia()
	.onError(({ error, code, set }) => {
		// Manually thrown errors
		if (error instanceof RealWorldError) {
			set.status = error.status;
			return pick(error, ["errors"]);
		}
		// Elysia validation errors (TypeBox based)
		if (error instanceof ValidationError) {
			return formatValidationError(error);
		}

		// Elysia not found errors
		if (error instanceof NotFoundError) {
			return formatNotFoundError(error);
		}

		// Generic error message
		const reason = isElysiaError(error)
			? error.response
			: DEFAULT_ERROR_MESSAGE;
		return {
			errors: {
				[code]: [reason],
			},
		};
	})
	.use(
		swagger({
			documentation: {
				info: { title, version: "", description },
				components: {
					securitySchemes: {
						tokenAuth: {
							type: "apiKey",
							description: 'Prefix the token with "Token", e.g. "Token xxxx"',
							in: "header",
							name: "Authorization",
						},
					},
				},
			},
			exclude: ["/"],
		}),
	)
	.use(auth())
	.get("/", ({ redirect }) => redirect("/swagger"))
	.get("/hello", () => "Hello Bedstack")
	.post(
		"/users",
		async ({ body }) => {
			const user = await db.insert(users).values(body).returning();
			return user;
		},
		{
			body: t.Object({
				name: t.String({ minLength: 2, examples: ["John Doe"] }),
			}),
		},
	)
	.get("/token", ({ token }) => token, {
		auth: true,
	})
	.listen(env.PORT);

console.log(
	`🦊 Bedstack is running at http://${app.server?.hostname}:${app.server?.port}`,
);
