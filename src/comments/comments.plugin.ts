import { eq } from "drizzle-orm";
import { Elysia, NotFoundError, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { articles } from "@/articles/articles.schema";
import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { commentsModel, UUID } from "./comments.model";
import { comments } from "./comments.schema";
import { toCommentResponse, toCommentsResponse } from "./mappers";

export const commentsPlugin = new Elysia({ tags: ["Comments"] })
	.use(auth)
	.use(commentsModel)
	.group("/articles/:slug/comments", (app) =>
		app
			.get(
				"/",
				async ({ params: { slug }, auth: { currentUserId } }) => {
					const article = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
					});
					if (!article) {
						throw new NotFoundError("article");
					}

					const enrichedComments = await db.query.comments.findMany({
						with: {
							author: currentUserId
								? {
										with: {
											followers: {
												where: eq(follows.followerId, currentUserId),
											},
										},
									}
								: true,
						},
						where: eq(comments.articleId, article.id),
						orderBy: (comments, { desc }) => [desc(comments.createdAt)],
					});

					const firstComment = enrichedComments[0];
					if (firstComment) {
						const followers = firstComment.author?.followers;
						enrichedComments.forEach((comment) => {
							comment.author.followers = followers;
						});
					}

					return toCommentsResponse(enrichedComments, { currentUserId });
				},
				{
					detail: {
						summary: "Get Comments from an Article",
						description: "Get the comments for of an article. Auth is optional",
					},
					response: "CommentsResponse",
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
				"/",
				async ({
					params: { slug },
					body: { comment },
					auth: { currentUserId },
				}) => {
					const article = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
					});
					if (!article) {
						throw new NotFoundError("article");
					}

					const [createdComment] = await db
						.insert(comments)
						.values({
							body: comment.body,
							articleId: article.id,
							authorId: currentUserId,
						})
						.returning();
					if (!createdComment) {
						throw new RealWorldError(StatusCodes.INTERNAL_SERVER_ERROR, {
							comment: ["failed to create"],
						});
					}

					const enrichedComment = await db.query.comments.findFirst({
						where: eq(comments.id, createdComment.id),
						with: {
							author: {
								with: {
									followers: {
										where: eq(follows.followerId, currentUserId),
									},
								},
							},
						},
					});
					if (!enrichedComment) {
						throw new NotFoundError("comment");
					}

					return toCommentResponse(enrichedComment, { currentUserId });
				},
				{
					detail: {
						summary: "Create a Comment for an Article",
						description: "Create a comment for an article. Auth is required",
					},
					body: "CreateComment",
					response: "CommentResponse",
				},
			)
			.delete(
				"/:id",
				async ({ params: { slug, id }, auth: { currentUserId }, set }) => {
					const article = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
					});
					if (!article) {
						throw new NotFoundError("article");
					}

					const existingComment = await db.query.comments.findFirst({
						where: eq(comments.id, id),
					});
					if (!existingComment) {
						throw new NotFoundError("comment");
					}

					if (existingComment.articleId !== article.id) {
						throw new NotFoundError("comment");
					}

					if (existingComment.authorId !== currentUserId) {
						throw new RealWorldError(StatusCodes.FORBIDDEN, {
							comment: ["you can only delete your own comments"],
						});
					}

					await db.delete(comments).where(eq(comments.id, id));

					set.status = StatusCodes.NO_CONTENT;
				},
				{
					detail: {
						summary: "Delete a Comment for an Article",
						description: "Delete a comment for an article. Auth is required",
					},
					params: t.Object({ id: UUID, slug: t.String() }),
					response: {
						[StatusCodes.NO_CONTENT]: t.Void({
							description: "No content",
						}),
					},
				},
			),
	);
