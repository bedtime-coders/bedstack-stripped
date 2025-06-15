import { db } from "@/db";
import { RealWorldError } from "@/errors/realworld";
import { auth } from "@/plugins/auth";
import { openapi } from "@/plugins/openapi";
import { users } from "@/schema";
import env from "@env";
import { eq } from "drizzle-orm";
import { Elysia, NotFoundError, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { pick } from "radashi";
import { errors } from "./plugins/errors";

const api = new Elysia({ prefix: "/api" }).use(auth()).group("/users", (app) =>
	app
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
						token: await sign(pick(foundUser, ["id", "email", "username"])),
						...pick(foundUser, ["email", "username", "bio", "image"]),
					},
				};
			},
			{
				detail: {
					summary: "Authentication",
				},
				body: t.Object({
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
				response: t.Object({
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
						bio: t.Union([
							t.String({ examples: ["I work at statefarm"] }),
							t.Null(),
						]),
						image: t.Union([
							t.String({
								examples: ["https://api.realworld.io/images/smiley-cyrus.jpg"],
							}),
							t.Null(),
						]),
					}),
				}),
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
							pattern:
								"^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$",
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
				response: t.Object({
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
						bio: t.Union([
							t.String({
								examples: ["I work at statefarm"],
							}),
							t.Null(),
						]),
						image: t.Union([
							t.String({
								examples: ["https://api.realworld.io/images/smiley-cyrus.jpg"],
							}),
							t.Null(),
						]),
					}),
				}),
			},
		),
);

const app = new Elysia().use(errors).use(openapi).use(api).listen(env.PORT);

console.log(
	`🦊 Bedstack is running at http://${app.server?.hostname}:${app.server?.port}`,
);
