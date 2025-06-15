import { db } from "@/db";
import { RealWorldError } from "@/errors/realworld";
import { auth } from "@/plugins/auth";
import { errors } from "@/plugins/errors";
import { openapi } from "@/plugins/openapi";
import { users } from "@/schema";
import env from "@env";
import chalk from "chalk";
import { eq } from "drizzle-orm";
import { Elysia, NotFoundError, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { mapKeys, pick } from "radashi";

const usersModel = new Elysia().model({
	LoginUser: t.Object({
		user: t.Object({
			email: t.String({
				format: "email",
				minLength: 1,
				examples: ["jake@jake.jake"],
			}),
			password: t.String({
				minLength: 1,
				examples: ["hunter2A"],
			}),
		}),
	}),
	RegisterUser: t.Object({
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
	UserResponse: t.Object({
		user: t.Object({
			email: t.String({
				examples: ["jake@jake.jake"],
			}),
			token: t.String({
				examples: [
					"eyJhbGciOiJIUzI1NiJ9.eyJpc3N1ZXIiOiJiZWRzdGFjay1zdHJpcHBlZCIsImlkIjoxMiwiZW1haWwiOiJqYWtlQGpha2UuamFrZTIiLCJ1c2VybmFtZSI6Impha2UyIiwiaWF0IjoxNzUwMDE2MDU0fQ.j_2URjoIZ6yJtpfNh21g4tvLdejCjcY-ot_7fq3wwTM",
				],
			}),
			username: t.String({
				examples: ["jake"],
			}),
			bio: t.Union([t.String({ examples: ["I work at statefarm"] }), t.Null()]),
			image: t.Union([
				t.String({
					examples: ["https://api.realworld.io/images/smiley-cyrus.jpg"],
				}),
				t.Null(),
			]),
		}),
	}),
});

const api = new Elysia({ prefix: "/api" })
	.use(auth)
	.group("/users", (app) =>
		app
			.use(usersModel)
			.post(
				"/login",
				async ({ body: { user }, auth: { sign } }) => {
					const [foundUser] = await db
						.select()
						.from(users)
						.where(eq(users.email, user.email))
						.limit(1);
					if (!foundUser) {
						throw new NotFoundError("user");
					}
					if (!(await Bun.password.verify(user.password, foundUser.password))) {
						throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
							user: ["invalid credentials"],
						});
					}
					return {
						user: {
							token: await sign(
								mapKeys(pick(foundUser, ["id", "email", "username"]), (key) =>
									key === "id" ? "uid" : key,
								) as Record<"email" | "username", string> & { uid: number },
							),
							...pick(foundUser, ["email", "username", "bio", "image"]),
						},
					};
				},
				{
					detail: {
						summary: "Authentication",
					},
					body: "LoginUser",
					response: "UserResponse",
				},
			)
			.post(
				"/",
				async ({ body: { user }, auth: { sign } }) => {
					const [createdUser] = await db
						.insert(users)
						.values(user)
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
							token: await sign(
								mapKeys(
									pick(createdUser, ["id", "email", "username"]),
									(key) => (key === "id" ? "uid" : key),
								) as Record<"email" | "username", string> & { uid: number },
							),
							...pick(createdUser, ["email", "username", "bio", "image"]),
						},
					};
				},
				{
					detail: {
						summary: "Registration",
					},
					body: "RegisterUser",
					response: "UserResponse",
				},
			),
	)
	.group("/user", (app) =>
		app.use(usersModel).get(
			"/",
			async ({ auth: { sign, jwtPayload } }) => {
				const user = await db.query.users.findFirst({
					where: eq(users.id, jwtPayload.uid),
				});
				if (!user) {
					throw new NotFoundError("user");
				}
				return {
					user: {
						token: await sign(
							mapKeys(pick(user, ["id", "email", "username"]), (key) =>
								key === "id" ? "uid" : key,
							) as Record<"email" | "username", string> & { uid: number },
						),
						...pick(user, ["email", "username", "bio", "image"]),
					},
				};
			},
			{
				detail: {
					summary: "Get Current User",
				},
				response: "UserResponse",
				auth: true,
			},
		),
	);

const app = new Elysia().use(errors).use(openapi).use(api).listen(env.PORT);

console.log(
	`Bedstack is up and running on ${chalk.blue(`http://${app.server?.hostname}:${app.server?.port}`)}`,
);
