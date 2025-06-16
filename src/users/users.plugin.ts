import { db } from "@/core/db";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { eq } from "drizzle-orm";
import { Elysia, NotFoundError } from "elysia";
import { StatusCodes } from "http-status-codes";
import { toResponse } from "./mappers";
import { usersModel } from "./users.model";
import { users } from "./users.schema";

export const usersPlugin = new Elysia()
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
					return toResponse(foundUser, sign);
				},
				{
					detail: {
						summary: "Authentication",
						description: "No authentication required, returns a User",
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
						.values({
							...user,
							password: await Bun.password.hash(user.password),
						})
						.onConflictDoNothing()
						.returning();
					if (!createdUser) {
						throw new RealWorldError(StatusCodes.CONFLICT, {
							user: ["already exists"],
						});
					}
					return toResponse(createdUser, sign);
				},
				{
					detail: {
						summary: "Registration",
						description: "No authentication required, returns a User",
					},
					body: "CreateUser",
					response: "UserResponse",
				},
			),
	)
	.group("/user", (app) =>
		app
			.use(usersModel)
			.get(
				"/",
				async ({ auth: { sign, jwtPayload } }) => {
					const user = await db.query.users.findFirst({
						where: eq(users.id, jwtPayload.uid),
					});
					if (!user) {
						throw new NotFoundError("user");
					}
					return toResponse(user, sign);
				},
				{
					detail: {
						summary: "Get Current User",
						description:
							"Authentication required, returns a User that’s the current user",
						security: [{ tokenAuth: [] }],
					},
					response: "UserResponse",
					auth: true,
				},
			)
			.put(
				"/",
				async ({ body: { user }, auth: { sign, jwtPayload } }) => {
					try {
						const [updatedUser] = await db
							.update(users)
							.set({
								...user,
								password: user?.password
									? await Bun.password.hash(user.password)
									: undefined,
							})
							.where(eq(users.id, jwtPayload.uid))
							.returning();
						if (!updatedUser) {
							throw new NotFoundError("user");
						}
						return toResponse(updatedUser, sign);
					} catch (error) {
						console.error(error);
						if (error instanceof RealWorldError) {
							throw error;
						}
						throw new RealWorldError(StatusCodes.INTERNAL_SERVER_ERROR, {
							user: ["internal server error"],
						});
					}
				},
				{
					detail: {
						summary: "Update User",
						description: "Authentication required, returns the updated User",
						security: [{ tokenAuth: [] }],
					},
					body: "UpdateUser",
					response: "UserResponse",
					auth: true,
				},
			),
	);
