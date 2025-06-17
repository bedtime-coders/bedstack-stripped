import { db } from "@/core/db";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { users } from "@/users/users.schema";
import { and, eq } from "drizzle-orm";
import { Elysia, NotFoundError } from "elysia";
import { StatusCodes } from "http-status-codes";
import { profilesModel } from "./profiles.model";
import { follows } from "./profiles.schema";

export const profilesPlugin = new Elysia()
	.use(auth)
	.use(profilesModel)
	.group("/profiles", (app) =>
		app
			.get(
				"/:username",
				async ({ params: { username }, jwt }) => {
					const user = await db.query.users.findFirst({
						where: eq(users.username, username),
					});

					if (!user) {
						throw new NotFoundError("profile");
					}

					let following = false;
					const jwtPayload = await jwt.verify();
					if (jwtPayload) {
						const follow = await db.query.follows.findFirst({
							where: and(
								eq(follows.followerId, jwtPayload.uid),
								eq(follows.followingId, user.id),
							),
						});
						following = Boolean(follow);
					}

					return {
						profile: {
							username: user.username,
							bio: user.bio,
							image: user.image,
							following,
						},
					};
				},
				{
					detail: {
						summary: "Get Profile",
						description:
							"Authentication optional, returns a [Profile](docs#model/profile)",
					},
					params: "Username",
					response: "Profile",
				},
			)
			.post(
				"/:username/follow",
				async ({ params: { username }, auth: { jwtPayload } }) => {
					const user = await db.query.users.findFirst({
						where: eq(users.username, username),
					});

					if (!user) {
						throw new NotFoundError("profile");
					}

					if (user.id === jwtPayload.uid) {
						throw new RealWorldError(StatusCodes.BAD_REQUEST, {
							profile: ["cannot follow yourself"],
						});
					}

					await db
						.insert(follows)
						.values({
							followerId: jwtPayload.uid,
							followingId: user.id,
						})
						.onConflictDoNothing();

					return {
						profile: {
							username: user.username,
							bio: user.bio,
							image: user.image,
							following: true,
						},
					};
				},
				{
					detail: {
						summary: "Follow user",
						description:
							"Authentication required, returns a [Profile](docs#model/profile)",
						security: [{ tokenAuth: [] }],
					},
					params: "Username",
					response: "Profile",
					auth: true,
				},
			)
			.delete(
				"/:username/follow",
				async ({ params: { username }, auth: { jwtPayload } }) => {
					const user = await db.query.users.findFirst({
						where: eq(users.username, username),
					});

					if (!user) {
						throw new NotFoundError("profile");
					}

					await db
						.delete(follows)
						.where(
							and(
								eq(follows.followerId, jwtPayload.uid),
								eq(follows.followingId, user.id),
							),
						);

					return {
						profile: {
							username: user.username,
							bio: user.bio,
							image: user.image,
							following: false,
						},
					};
				},
				{
					detail: {
						summary: "Unfollow user",
						description:
							"Authentication required, returns a [Profile](docs#model/profile)",
						security: [{ tokenAuth: [] }],
					},
					params: "Username",
					response: "Profile",
					auth: true,
				},
			),
	);
