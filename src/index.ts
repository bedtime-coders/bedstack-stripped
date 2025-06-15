import { db } from "@/db";
import { RealWorldError } from "@/errors/realworld";
import { auth } from "@/plugins/auth";
import { openapi } from "@/plugins/openapi";
import { users } from "@/schema";
import env from "@env";
import { Elysia, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { pick } from "radashi";
import { errors } from "./plugins/errors";

const api = new Elysia({ prefix: "api" })
	.use(auth())
	.get("/auth", ({ status }) => status(StatusCodes.NO_CONTENT), { auth: true })
	.post(
		"/users",
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

const app = new Elysia().use(errors).use(openapi).use(api).listen(env.PORT);

console.log(
	`🦊 Bedstack is running at http://${app.server?.hostname}:${app.server?.port}`,
);
