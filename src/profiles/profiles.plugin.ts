import { and, eq } from "drizzle-orm";
import { Elysia, NotFoundError, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { db } from "@/core/database/db";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { toResponse } from "./mappers";
import { profilesModel } from "./profiles.model";
import { follows } from "./profiles.schema";

export const profiles = new Elysia({ tags: ["Profiles"] })
	.use(auth)
	.use(profilesModel)
	.group(
		"/profiles",
		{
			params: t.Object({
				username: t.String({
					examples: ["jake"],
				}),
			}),
		},
		(app) =>
			app
				.get(
					"/:username",
					async ({ params: { username }, auth: { currentUserId } }) => {
						const user = await db.query.users.findFirst({
							where: { username },
						});
						if (!user) throw new NotFoundError("profile");
						const following = currentUserId
							? Boolean(
									await db.query.follows.findFirst({
										where: {
											followerId: currentUserId,
											followedId: user.id,
										},
									}),
								)
							: false;
						return toResponse(user, following);
					},
					{
						detail: {
							summary: "Get Profile",
							description:
								"Authentication optional, returns a [Profile](docs#model/profile)",
						},
						response: "Profile",
					},
				)
				.guard({
					auth: true,
					detail: {
						security: [{ tokenAuth: [] }],
						description: "Authentication required",
					},
				})
				.post(
					"/:username/follow",
					async ({ params: { username }, auth: { currentUserId } }) => {
						const user = await db.query.users.findFirst({
							where: { username },
						});
						if (!user) throw new NotFoundError("profile");
						if (user.id === currentUserId) {
							throw new RealWorldError(StatusCodes.UNPROCESSABLE_ENTITY, {
								profile: ["cannot be followed by yourself"],
							});
						}
						await db
							.insert(follows)
							.values({
								followerId: currentUserId,
								followedId: user.id,
							})
							.onConflictDoNothing();
						return toResponse(user, true);
					},
					{
						detail: {
							summary: "Follow user",
							description:
								"Authentication required, returns a [Profile](docs#model/profile)",
						},
						response: "Profile",
					},
				)
				.delete(
					"/:username/follow",
					async ({ params: { username }, auth: { currentUserId } }) => {
						const user = await db.query.users.findFirst({
							where: { username },
						});
						if (!user) throw new NotFoundError("profile");
						if (user.id === currentUserId) {
							throw new RealWorldError(StatusCodes.UNPROCESSABLE_ENTITY, {
								profile: ["cannot be unfollowed by yourself"],
							});
						}
						await db
							.delete(follows)
							.where(
								and(
									eq(follows.followerId, currentUserId),
									eq(follows.followedId, user.id),
								),
							);
						return toResponse(user, false);
					},
					{
						detail: {
							summary: "Unfollow user",
							description:
								"Authentication required, returns a [Profile](docs#model/profile)",
						},
						response: "Profile",
					},
				),
	);
