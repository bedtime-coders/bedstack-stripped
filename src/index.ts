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
import { StatusCodes } from "http-status-codes";
import { pick } from "radashi";
import { description, title } from "../package.json";
import { DEFAULT_ERROR_MESSAGE } from "./consts";

const api = new Elysia({ prefix: "api" })
	.use(auth())
	.get("/auth", ({ status }) => status(StatusCodes.NO_CONTENT), { auth: true })
	.post(
		"/users",
		async ({
			body: {
				user: { email, password, username, bio, image },
			},
			auth: { sign },
		}) => {
			const [createdUser] = await db
				.insert(users)
				.values({
					email,
					password: await Bun.password.hash(password),
					username,
					bio,
					image,
				})
				.onConflictDoNothing()
				.returning();
			if (!createdUser) {
				// TODO: consider selecting, and returning which field conflicted
				throw new RealWorldError(StatusCodes.CONFLICT, {
					user: ["already exists"],
				});
			}
			return {
				user: {
					token: await sign(pick(createdUser, ["id", "email", "username"])),
					...pick(createdUser, ["email", "username", "bio", "image"]),
				},
			};
		},
		{
			detail: {
				summary: "Registration",
			},
			body: t.Object({
				user: t.Object({
					email: t.String({
						format: "email",
						examples: ["jake@jake.jake"],
					}),
					password: t.String({
						minLength: 8,
						maxLength: 100,
						pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$",
						description:
							"must be at least 8 characters and contain uppercase, lowercase, and numbers",
						examples: ["hunter2A"],
					}),
					username: t.String({ minLength: 2, examples: ["jake"] }),
					bio: t.Optional(
						t.String({
							minLength: 2,
							examples: ["I work at statefarm"],
						}),
					),
					image: t.Optional(
						t.String({
							format: "uri",
							examples: ["https://api.realworld.io/images/smiley-cyrus.jpg"],
						}),
					),
				}),
			}),
		},
	);

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
			scalarVersion: "1.31.10",
		}),
	)
	.use(api)
	.get("/", ({ redirect }) => redirect("/swagger"))
	.listen(env.PORT);

console.log(
	`🦊 Bedstack is running at http://${app.server?.hostname}:${app.server?.port}`,
);
