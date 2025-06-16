import { db } from "@/core/db";
import { users } from "@/schema";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import type { ModelsStatic } from "@/shared/types/elysia";
import { type InferSelectModel, eq } from "drizzle-orm";
import { Elysia, NotFoundError, t } from "elysia";
import { StatusCodes } from "http-status-codes";

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

type SignFn = (payload: {
	uid: number;
	email: string;
	username: string;
}) => Promise<string>;

const toUserResponse = async (
	user: InferSelectModel<typeof users>,
	sign: SignFn,
): Promise<ModelsStatic<typeof usersModel.models>["UserResponse"]> => {
	const { email, username, bio, image } = user;
	return {
		user: {
			token: await sign({ uid: user.id, email, username }),
			email,
			username,
			bio,
			image,
		},
	};
};

export const api = new Elysia({ prefix: "/api" })
	.use(auth)
	.group("/users", (app) =>
		app
			.use(usersModel)
			.post(
				"/login",
				async ({ body: { user }, auth: { sign } }) => {
					const foundUser = await db.query.users.findFirst({
						where: eq(users.email, user.email),
					});
					if (!foundUser) {
						throw new NotFoundError("user");
					}
					if (!(await Bun.password.verify(user.password, foundUser.password))) {
						throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
							user: ["invalid credentials"],
						});
					}
					return toUserResponse(foundUser, sign);
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
					return toUserResponse(createdUser, sign);
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
				return toUserResponse(user, sign);
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
