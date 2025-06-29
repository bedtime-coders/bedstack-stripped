import { and, eq } from "drizzle-orm";
import { Elysia, NotFoundError, t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { db } from "@/core/database/db";
import { DEFAULT_LIMIT, DEFAULT_OFFSET } from "@/shared/constants";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { slugify } from "@/shared/utils";
import { articlesToTags, tags } from "@/tags/tags.schema";
import { ArticleQuery, articlesModel, FeedQuery } from "./articles.model";
import { articles, favorites } from "./articles.schema";
import { toArticlesResponse, toResponse } from "./mappers";

export const articlesPlugin = new Elysia({ tags: ["Articles"] })
	.use(auth)
	.use(articlesModel)
	.group("/articles", (app) =>
		app
			.get(
				"/",
				async ({
					query: {
						tag: tagName,
						author: authorUsername,
						favorited: favoritedByUsername,
						limit = DEFAULT_LIMIT,
						offset = DEFAULT_OFFSET,
					},
					auth: { currentUserId },
				}) => {
					const enrichedArticles = await db.query.articles.findMany({
						where: {
							...(authorUsername && {
								author: {
									username: authorUsername,
								},
							}),
							...(favoritedByUsername && {
								favorites: {
									user: {
										username: favoritedByUsername,
									},
								},
							}),
							...(tagName && {
								tags: {
									name: tagName,
								},
							}),
						},
						with: {
							author: {
								with: {
									followers: {
										where: {
											id: currentUserId,
										},
									},
								},
							},
							tags: true,
							favorites: true,
						},
						orderBy: { createdAt: "desc" },
						limit,
						offset,
					});
					return toArticlesResponse(enrichedArticles, {
						currentUserId,
					});
				},
				{
					detail: {
						summary: "List Articles",
						description:
							"Returns most recent articles globally by default, provide tag, author or favorited query parameter to filter results",
					},
					query: ArticleQuery,
					response: "ArticlesResponse",
				},
			)
			.get(
				"/:slug",
				async ({ params: { slug }, auth: { currentUserId } }) => {
					const enrichedArticle = await db.query.articles.findFirst({
						where: { slug },
						with: {
							author: {
								with: {
									followers: {
										where: {
											id: currentUserId,
										},
									},
								},
							},
							tags: true,
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					return toResponse(enrichedArticle, { currentUserId });
				},
				{
					detail: {
						summary: "Get Article",
						description:
							"No authentication required, will return single article",
					},
					response: "Article",
				},
			)
			.guard({
				auth: true,
				detail: {
					security: [{ tokenAuth: [] }],
					description: "Authentication required",
				},
			})
			.get(
				"/feed",
				async ({
					query: { limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET },
					auth: { currentUserId },
				}) => {
					const enrichedArticles = await db.query.articles.findMany({
						where: {
							author: {
								followers: {
									id: currentUserId,
								},
							},
						},
						with: {
							author: {
								with: {
									followers: {
										where: {
											id: currentUserId,
										},
									},
								},
							},
							tags: true,
							favorites: true,
						},
						orderBy: {
							createdAt: "desc",
						},
						limit,
						offset,
					});
					return toArticlesResponse(enrichedArticles, { currentUserId });
				},
				{
					detail: {
						summary: "Feed Articles",
						description:
							"Can also take limit and offset query parameters like List Articles. Authentication required, will return multiple articles created by followed users, ordered by most recent first.",
					},
					query: FeedQuery,
					response: "ArticlesResponse",
				},
			)
			.post(
				"/",
				async ({ body: { article }, auth: { currentUserId } }) => {
					const slug = slugify(article.title);

					const tagList = article.tagList ?? [];

					await db
						.insert(tags)
						.values(tagList.map((name) => ({ name })))
						.onConflictDoNothing();

					const relevantTags = await db.query.tags.findMany({
						where: {
							name: {
								in: tagList,
							},
						},
					});

					const [createdArticle] = await db
						.insert(articles)
						.values({
							slug,
							title: article.title,
							description: article.description,
							body: article.body,
							authorId: currentUserId,
						})
						.returning();

					if (!createdArticle) {
						throw new RealWorldError(StatusCodes.INTERNAL_SERVER_ERROR, {
							article: ["failed to create"],
						});
					}
					await db.insert(articlesToTags).values(
						relevantTags.map((tag) => ({
							articleId: createdArticle.id,
							tagId: tag.id,
						})),
					);

					const enrichedArticle = await db.query.articles.findFirst({
						where: { id: createdArticle.id },
						with: {
							author: true,
							tags: true,
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					return toResponse(enrichedArticle);
				},
				{
					detail: {
						summary: "Create Article",
						description: "Authentication required, will return an Article",
					},
					body: "CreateArticle",
					response: "Article",
				},
			)
			.put(
				"/:slug",
				async ({
					params: { slug },
					body: { article },
					auth: { currentUserId },
				}) => {
					const existingArticle = await db.query.articles.findFirst({
						where: { slug },
					});

					if (!existingArticle) {
						throw new NotFoundError("article");
					}

					if (existingArticle.authorId !== currentUserId) {
						throw new RealWorldError(StatusCodes.FORBIDDEN, {
							article: ["you can only update your own articles"],
						});
					}

					const newSlug =
						article.title && article.title !== existingArticle.title
							? slugify(article.title)
							: existingArticle.slug;

					// Update article
					const [updatedArticle] = await db
						.update(articles)
						.set({
							...article,
							slug: newSlug,
						})
						.where(eq(articles.id, existingArticle.id))
						.returning();

					if (!updatedArticle) {
						throw new RealWorldError(StatusCodes.INTERNAL_SERVER_ERROR, {
							article: ["failed to update"],
						});
					}

					// Handle tag updates
					if (article.tagList !== undefined) {
						// Remove existing tags
						await db
							.delete(articlesToTags)
							.where(eq(articlesToTags.articleId, existingArticle.id));

						// Add new tags if any
						if (article.tagList.length > 0) {
							// Batch insert tags (ignore conflicts)
							await db
								.insert(tags)
								.values(article.tagList.map((name) => ({ name })))
								.onConflictDoNothing();

							// Get all relevant tags in one query
							const relevantTags = await db.query.tags.findMany({
								where: {
									name: {
										in: article.tagList,
									},
								},
							});

							// Connect tags to article
							await db.insert(articlesToTags).values(
								relevantTags.map((tag) => ({
									articleId: existingArticle.id,
									tagId: tag.id,
								})),
							);
						}
					}

					// Get updated article with relations
					const enrichedArticle = await db.query.articles.findFirst({
						where: { id: updatedArticle.id },
						with: {
							author: {
								with: {
									followers: {
										where: {
											id: currentUserId,
										},
									},
								},
							},
							tags: true,
							favorites: true, // Load all favorites to get count
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					return toResponse(enrichedArticle, { currentUserId });
				},
				{
					detail: {
						summary: "Update Article",
						description:
							"Authentication required, returns the updated Article. The slug also gets updated when the title is changed.",
					},
					body: "UpdateArticle",
					response: "Article",
				},
			)
			.delete(
				"/:slug",
				async ({ params: { slug }, auth: { currentUserId }, set }) => {
					const existingArticle = await db.query.articles.findFirst({
						where: { slug },
					});

					if (!existingArticle) {
						throw new NotFoundError("article");
					}

					if (existingArticle.authorId !== currentUserId) {
						throw new RealWorldError(StatusCodes.FORBIDDEN, {
							article: ["you can only delete your own articles"],
						});
					}

					await db.delete(articles).where(eq(articles.id, existingArticle.id));

					set.status = StatusCodes.NO_CONTENT;
				},
				{
					detail: {
						summary: "Delete Article",
					},
					response: {
						[StatusCodes.NO_CONTENT]: t.Void({
							description: "No content",
						}),
					},
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
				"/:slug/favorite",
				async ({ params: { slug }, auth: { currentUserId } }) => {
					// Fetch everything in one go
					const enrichedArticle = await db.query.articles.findFirst({
						where: { slug },
						with: {
							author: {
								with: {
									followers: {
										where: {
											id: currentUserId,
										},
									},
								},
							},
							tags: true,
							favorites: true, // Load all favorites to get count
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					const isAlreadyFavorited = enrichedArticle.favorites.some(
						(fav) => fav.userId === currentUserId,
					);

					// Only add if not already favorited
					if (!isAlreadyFavorited) {
						await db.insert(favorites).values({
							userId: currentUserId,
							articleId: enrichedArticle.id,
						});

						// Reload the article to get updated favorites count
						const updatedArticle = await db.query.articles.findFirst({
							where: { slug },
							with: {
								author: {
									with: {
										followers: {
											where: {
												id: currentUserId,
											},
										},
									},
								},
								tags: true,
								favorites: true,
							},
						});

						if (updatedArticle) {
							return toResponse(updatedArticle, { currentUserId });
						}
					}

					return toResponse(enrichedArticle, { currentUserId });
				},
				{
					detail: {
						summary: "Favorite Article",
						description: "Authentication required, returns the Article",
					},
					response: "Article",
				},
			)
			.delete(
				"/:slug/favorite",
				async ({ params: { slug }, auth: { currentUserId } }) => {
					// Fetch everything in one go
					const enrichedArticle = await db.query.articles.findFirst({
						where: { slug },
						with: {
							author: {
								with: {
									followers: {
										where: {
											id: currentUserId,
										},
									},
								},
							},
							tags: true,
							favorites: true, // Load all favorites to get count
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					const isAlreadyFavorited = enrichedArticle.favorites?.some(
						(fav) => fav.userId === currentUserId,
					);

					if (isAlreadyFavorited) {
						// Delete the favorite
						await db
							.delete(favorites)
							.where(
								and(
									eq(favorites.userId, currentUserId),
									eq(favorites.articleId, enrichedArticle.id),
								),
							);

						// Reload the article to get updated favorites count
						const updatedArticle = await db.query.articles.findFirst({
							where: { slug },
							with: {
								author: {
									with: {
										followers: {
											where: {
												id: currentUserId,
											},
										},
									},
								},
								tags: true,
								favorites: true,
							},
						});

						if (updatedArticle) {
							return toResponse(updatedArticle, { currentUserId });
						}
					}

					return toResponse(enrichedArticle, { currentUserId });
				},
				{
					detail: {
						summary: "Unfavorite Article",
						description: "Authentication required, returns the Article",
					},
					response: "Article",
				},
			),
	);
