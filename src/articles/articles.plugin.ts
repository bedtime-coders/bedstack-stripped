import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Elysia, NotFoundError } from "elysia";
import { StatusCodes } from "http-status-codes";
import { sift } from "radashi";
import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import { DEFAULT_LIMIT, DEFAULT_OFFSET } from "@/shared/constants";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { slugify } from "@/shared/utils";
import { articlesToTags, tags } from "@/tags/tags.schema";
import { users } from "@/users/users.schema";
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
						tag,
						author: authorUsername,
						favorited: favoritedByUsername,
						limit = DEFAULT_LIMIT,
						offset = DEFAULT_OFFSET,
					},
					auth: { currentUserId },
				}) => {
					const [authorUser, favoritedUser] = await Promise.all([
						authorUsername
							? db.query.users.findFirst({
									where: eq(users.username, authorUsername),
								})
							: undefined,
						favoritedByUsername
							? db.query.users.findFirst({
									where: eq(users.username, favoritedByUsername),
								})
							: undefined,
					]);

					if (
						(authorUsername && !authorUser) ||
						(favoritedByUsername && !favoritedUser)
					) {
						return toArticlesResponse([]);
					}

					// Build where conditions
					const whereConditions = [];
					if (authorUser) {
						whereConditions.push(eq(articles.authorId, authorUser.id));
					}
					if (favoritedUser) {
						// For favorited filter, we need to check if the article has a favorite by this user
						const favoritedArticleIds = await db
							.select({ articleId: favorites.articleId })
							.from(favorites)
							.where(eq(favorites.userId, favoritedUser.id));
						if (favoritedArticleIds.length > 0) {
							whereConditions.push(
								inArray(
									articles.id,
									favoritedArticleIds.map((f) => f.articleId),
								),
							);
						} else {
							return toArticlesResponse([]);
						}
					}
					if (tag) {
						// For tag filter, we need to check if the article has this tag
						const taggedArticleIds = await db
							.select({ articleId: articlesToTags.articleId })
							.from(articlesToTags)
							.innerJoin(tags, eq(tags.id, articlesToTags.tagId))
							.where(eq(tags.name, tag));
						if (taggedArticleIds.length > 0) {
							whereConditions.push(
								inArray(
									articles.id,
									taggedArticleIds.map((t) => t.articleId),
								),
							);
						} else {
							return toArticlesResponse([]);
						}
					}

					const articlesWithData = await db.query.articles.findMany({
						where:
							whereConditions.length > 0 ? and(...whereConditions) : undefined,
						with: {
							author: true,
							tags: {
								with: {
									tag: true,
								},
							},
						},
						orderBy: [desc(articles.createdAt)],
						limit,
						offset,
					});

					if (articlesWithData.length === 0) return toArticlesResponse([]);
					if (!currentUserId) {
						return toArticlesResponse(articlesWithData);
					}

					const articleIds = articlesWithData.map((a) => a.id);
					const authorIds = articlesWithData.map((a) => a.author.id);

					// Load extras (favorited, favorites count, following) - batched
					const [favoritesCounts, userFavorites, followStatus] =
						await Promise.all([
							db
								.select({
									articleId: favorites.articleId,
									_count: count().as("_count"),
								})
								.from(favorites)
								.where(inArray(favorites.articleId, articleIds))
								.groupBy(favorites.articleId),
							db.query.favorites.findMany({
								columns: { articleId: true },
								where: and(
									eq(favorites.userId, currentUserId),
									inArray(favorites.articleId, articleIds),
								),
							}),
							db.query.follows
								.findMany({
									columns: { followedId: true },
									where: and(
										eq(follows.followerId, currentUserId),
										inArray(follows.followedId, authorIds),
									),
								})
								.then((follows) =>
									follows.map((f) => ({ followingId: f.followedId })),
								),
						]);

					return toArticlesResponse(articlesWithData, {
						userFavorites,
						followStatus,
						favoritesCounts,
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
					if (!currentUserId) {
						const enrichedArticle = await db.query.articles.findFirst({
							where: eq(articles.slug, slug),
							with: {
								author: true,
								tags: {
									with: {
										tag: true,
									},
								},
							},
						});

						if (!enrichedArticle) {
							throw new NotFoundError("article");
						}

						return toResponse(enrichedArticle, {
							favorited: false,
							favoritesCount: 0,
							following: false,
						});
					}

					const enrichedArticle = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
						with: {
							author: {
								with: {
									followers: {
										where: eq(follows.followerId, currentUserId),
									},
								},
							},
							tags: {
								with: {
									tag: true,
								},
							},
							favorites: {
								where: eq(favorites.userId, currentUserId),
							},
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					// Get favorites count
					const [favoritesCountResult] = await db
						.select({ count: count() })
						.from(favorites)
						.where(eq(favorites.articleId, enrichedArticle.id));

					return toResponse(enrichedArticle, {
						favorited: enrichedArticle.favorites.length > 0,
						favoritesCount: Number(favoritesCountResult?.count || 0),
						following: enrichedArticle.author.followers.length > 0,
					});
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
					// Get followed user IDs
					const followed = await db
						.select({ followedId: follows.followedId })
						.from(follows)
						.where(eq(follows.followerId, currentUserId));

					const followedIds = followed.map((f) => f.followedId);
					if (followedIds.length === 0) return toArticlesResponse([]);

					// Get articles from followed authors
					const articlesWithData = await db.query.articles.findMany({
						where: inArray(articles.authorId, followedIds),
						with: {
							author: true,
							tags: {
								with: {
									tag: true,
								},
							},
						},
						orderBy: [desc(articles.createdAt)],
						limit,
						offset,
					});

					if (articlesWithData.length === 0) return toArticlesResponse([]);

					const articleIds = articlesWithData.map((a) => a.id);
					const authorIds = articlesWithData.map((a) => a.author.id);

					// Get favorites count, user favorited, follow status
					const [favoritesCounts, userFavorites, followStatus] =
						await Promise.all([
							db
								.select({
									articleId: favorites.articleId,
									_count: count().as("_count"),
								})
								.from(favorites)
								.where(inArray(favorites.articleId, articleIds))
								.groupBy(favorites.articleId),
							db.query.favorites.findMany({
								columns: { articleId: true },
								where: and(
									eq(favorites.userId, currentUserId),
									inArray(favorites.articleId, articleIds),
								),
							}),
							db.query.follows
								.findMany({
									columns: { followedId: true },
									where: and(
										eq(follows.followerId, currentUserId),
										inArray(follows.followedId, authorIds),
									),
								})
								.then((follows) =>
									follows.map((f) => ({ followingId: f.followedId })),
								),
						]);

					return toArticlesResponse(articlesWithData, {
						userFavorites,
						followStatus,
						favoritesCounts,
					});
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

					// Upsert tags
					const tagList = article.tagList ?? [];
					const createdTags = await Promise.all(
						tagList.map(async (name) => {
							const existingTag = await db.query.tags.findFirst({
								where: eq(tags.name, name),
							});
							if (existingTag) {
								return existingTag;
							}

							const [newTag] = await db
								.insert(tags)
								.values({ name })
								.returning();

							if (!newTag) {
								throw new RealWorldError(StatusCodes.INTERNAL_SERVER_ERROR, {
									tag: [`failed to create tag: ${name}`],
								});
							}
							return newTag;
						}),
					);

					// Create article
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

					// Connect tags
					if (createdTags.length > 0) {
						await db.insert(articlesToTags).values(
							createdTags.map((tag) => ({
								articleId: createdArticle.id,
								tagId: tag.id,
							})),
						);
					}

					// Get created article with relations
					const enrichedArticle = await db.query.articles.findFirst({
						where: eq(articles.id, createdArticle.id),
						with: {
							author: true,
							tags: {
								with: {
									tag: true,
								},
							},
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					return toResponse(enrichedArticle, {
						favorited: false,
						favoritesCount: 0,
						following: false, // you can't follow yourself
					});
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
						where: eq(articles.slug, slug),
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

						// Add new tags
						if (article.tagList.length > 0) {
							const updatedTags = await Promise.all(
								article.tagList.map(async (name) => {
									const existingTag = await db.query.tags.findFirst({
										where: eq(tags.name, name),
									});
									if (existingTag) {
										return existingTag;
									}

									const [newTag] = await db
										.insert(tags)
										.values({ name })
										.returning();

									if (!newTag) {
										throw new RealWorldError(
											StatusCodes.INTERNAL_SERVER_ERROR,
											{
												tag: [`failed to create tag: ${name}`],
											},
										);
									}
									return newTag;
								}),
							);

							await db.insert(articlesToTags).values(
								updatedTags.map((tag) => ({
									articleId: existingArticle.id,
									tagId: tag.id,
								})),
							);
						}
					}

					// Get updated article with relations
					const enrichedArticle = await db.query.articles.findFirst({
						where: eq(articles.id, updatedArticle.id),
						with: {
							author: {
								with: {
									followers: {
										where: eq(follows.followerId, currentUserId),
									},
								},
							},
							tags: {
								with: {
									tag: true,
								},
							},
							favorites: {
								where: eq(favorites.userId, currentUserId),
							},
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					// Get favorites count
					const [favoritesCountResult] = await db
						.select({ count: count() })
						.from(favorites)
						.where(eq(favorites.articleId, enrichedArticle.id));

					return toResponse(enrichedArticle, {
						favorited: enrichedArticle.favorites.length > 0,
						favoritesCount: Number(favoritesCountResult?.count || 0),
						following: enrichedArticle.author.followers.length > 0,
					});
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
				async ({ params: { slug }, auth: { currentUserId } }) => {
					const existingArticle = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
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

					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					detail: {
						summary: "Delete Article",
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
						where: eq(articles.slug, slug),
						with: {
							author: {
								with: {
									followers: {
										where: eq(follows.followerId, currentUserId),
									},
								},
							},
							tags: {
								with: {
									tag: true,
								},
							},
							favorites: {
								where: eq(favorites.userId, currentUserId),
							},
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					// Get favorites count
					const [favoritesCountResult] = await db
						.select({ count: count() })
						.from(favorites)
						.where(eq(favorites.articleId, enrichedArticle.id));

					const currentFavoritesCount = Number(
						favoritesCountResult?.count || 0,
					);

					// Only add if not already favorited
					if (enrichedArticle.favorites.length === 0) {
						await db.insert(favorites).values({
							userId: currentUserId,
							articleId: enrichedArticle.id,
						});
					}

					return toResponse(enrichedArticle, {
						favorited: true,
						favoritesCount:
							currentFavoritesCount +
							(enrichedArticle.favorites.length === 0 ? 1 : 0),
						following: enrichedArticle.author.followers.length > 0,
					});
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
						where: eq(articles.slug, slug),
						with: {
							author: {
								with: {
									followers: {
										where: eq(follows.followerId, currentUserId),
									},
								},
							},
							tags: {
								with: {
									tag: true,
								},
							},
							favorites: {
								where: eq(favorites.userId, currentUserId),
							},
						},
					});

					if (!enrichedArticle) {
						throw new NotFoundError("article");
					}

					// Get favorites count
					const [favoritesCountResult] = await db
						.select({ count: count() })
						.from(favorites)
						.where(eq(favorites.articleId, enrichedArticle.id));

					const currentFavoritesCount = Number(
						favoritesCountResult?.count || 0,
					);

					if (enrichedArticle.favorites.length === 0) {
						return toResponse(enrichedArticle, {
							favorited: false,
							favoritesCount: currentFavoritesCount,
							following: enrichedArticle.author.followers.length > 0,
						});
					}

					// Delete the favorite
					await db
						.delete(favorites)
						.where(
							and(
								eq(favorites.userId, currentUserId),
								eq(favorites.articleId, enrichedArticle.id),
							),
						);

					return toResponse(enrichedArticle, {
						favorited: false,
						favoritesCount: currentFavoritesCount - 1,
						following: enrichedArticle.author.followers.length > 0,
					});
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
