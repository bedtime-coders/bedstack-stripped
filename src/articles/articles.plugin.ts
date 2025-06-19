import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import { RealWorldError } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { slugify } from "@/shared/utils";
import { users } from "@/users/users.schema";
import { and, count, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import type { InferSelectModel, SQL } from "drizzle-orm";
import { Elysia, NotFoundError } from "elysia";
import { StatusCodes } from "http-status-codes";
import { omit, sift } from "radashi";
import { ArticleQuery, FeedQuery, articlesModel } from "./articles.model";
import { articleTags, articles, favorites, tags } from "./articles.schema";
import { toArticlesResponse, toResponse } from "./mappers";

export const articlesPlugin = new Elysia({
	tags: ["Articles"],
})
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
						limit = 20,
						offset = 0,
					},
					auth: { jwtPayload },
				}) => {
					const currentUserId = jwtPayload?.uid;
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

					const paginatedArticleIds = await db
						.select({ id: articles.id })
						.from(articles)
						.innerJoin(users, eq(articles.authorId, users.id))
						.leftJoin(articleTags, eq(articleTags.articleId, articles.id))
						.leftJoin(tags, eq(tags.id, articleTags.tagId))
						.leftJoin(favorites, eq(favorites.articleId, articles.id))
						.where(
							and(
								authorUser ? eq(articles.authorId, authorUser.id) : undefined,
								favoritedUser
									? eq(favorites.userId, favoritedUser.id)
									: undefined,
								tag ? eq(tags.name, tag) : undefined,
							),
						)
						.groupBy(articles.id) // Ensure 1 row per article
						.orderBy(desc(articles.createdAt))
						.limit(limit)
						.offset(offset);

					const articleIds = paginatedArticleIds.map((row) => row.id);
					if (articleIds.length === 0) return toArticlesResponse([]);

					const rows = await db
						.select({
							article: getTableColumns(articles),
							author: getTableColumns(users),
							tag: getTableColumns(tags),
						})
						.from(articles)
						.innerJoin(users, eq(articles.authorId, users.id))
						.leftJoin(articleTags, eq(articleTags.articleId, articles.id))
						.leftJoin(tags, eq(tags.id, articleTags.tagId))
						.where(inArray(articles.id, articleIds));

					// Now each article can appear in multiple rows, one for each tag
					// We need to group them by article and then transform them to the expected shape
					const articlesMap = new Map<
						string,
						Omit<InferSelectModel<typeof articles>, "authorId"> & {
							author: InferSelectModel<typeof users>;
							tags: string[];
						}
					>();
					for (const row of rows) {
						const articleId = row.article.id;
						if (!articlesMap.has(articleId)) {
							articlesMap.set(articleId, {
								...omit(row.article, ["authorId"]),
								author: row.author,
								tags: [],
							});
						}
						const tagName = row.tag?.name;
						if (!tagName) continue;
						const article = articlesMap.get(articleId);
						if (!article) continue;
						if (article.tags.includes(tagName)) continue;
						article.tags.push(tagName);
					}

					const articlesWithData = Array.from(articlesMap.values());
					const authorIds = articlesWithData.map((a) => a.author.id);

					//  Handle extras (favorites, author following)
					const [favoritesCounts, userFavorites, followStatus] =
						await Promise.all([
							db
								.select({ articleId: favorites.articleId, count: count() })
								.from(favorites)
								.where(inArray(favorites.articleId, articleIds))
								.groupBy(favorites.articleId),
							currentUserId
								? db
										.select({ articleId: favorites.articleId })
										.from(favorites)
										.where(
											and(
												eq(favorites.userId, currentUserId),
												inArray(favorites.articleId, articleIds),
											),
										)
								: [],
							currentUserId
								? db
										.select({ followingId: follows.followingId })
										.from(follows)
										.where(
											and(
												eq(follows.followerId, currentUserId),
												inArray(follows.followingId, authorIds),
											),
										)
								: [],
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
				async ({ params: { slug }, auth: { jwtPayload } }) => {
					const articleWithData = await db.query.articles.findFirst({
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

					if (!articleWithData) {
						throw new NotFoundError("article");
					}

					return toResponse(articleWithData, jwtPayload?.uid);
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
				async ({ query, auth: { jwtPayload } }) => {
					const { limit = 20, offset = 0 } = query;

					// Get articles from followed authors using relational queries
					const articlesWithAuthors = await db.query.articles.findMany({
						with: {
							author: true,
							tags: {
								with: {
									tag: true,
								},
							},
						},
						where: (articles, { eq }) =>
							eq(articles.authorId, follows.followingId),
						orderBy: (articles, { desc }) => [desc(articles.createdAt)],
						limit,
						offset,
					});

					// Filter by followed authors
					const followedUserIds = await db
						.select({ followingId: follows.followingId })
						.from(follows)
						.where(eq(follows.followerId, jwtPayload.uid));

					const followedIds = followedUserIds.map((f) => f.followingId);
					const filteredArticles = articlesWithAuthors.filter((article) =>
						followedIds.includes(article.authorId),
					);

					// Transform the data to match the expected format
					const articlesWithData = filteredArticles.map((article) => ({
						...article,
						tags: article.tags.map((articleTag) => articleTag.tag.name),
					}));

					return toArticlesResponse(articlesWithData);
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
				async ({ body: { article }, auth: { jwtPayload } }) => {
					const slug = slugify(article.title);

					// Create article
					const [createdArticle] = await db
						.insert(articles)
						.values({
							slug,
							title: article.title,
							description: article.description,
							body: article.body,
							authorId: jwtPayload.uid,
						})
						.returning();

					if (!createdArticle) {
						throw new RealWorldError(StatusCodes.INTERNAL_SERVER_ERROR, {
							article: ["failed to create"],
						});
					}

					// Handle tags
					if (article.tagList && article.tagList.length > 0) {
						// Create or get existing tags
						const tagPromises = article.tagList.map(async (tagName) => {
							const existingTag = await db.query.tags.findFirst({
								where: eq(tags.name, tagName),
							});
							if (existingTag) {
								return existingTag;
							}

							const [newTag] = await db
								.insert(tags)
								.values({ name: tagName })
								.returning();

							if (!newTag) {
								console.error(
									"Unexpected error: Could not create tag",
									tagName,
								);
							}
							return newTag;
						});

						const createdTags = sift(await Promise.all(tagPromises));

						// Associate tags with article
						await db.insert(articleTags).values(
							createdTags.map((tag) => ({
								articleId: createdArticle.id,
								tagId: tag.id,
							})),
						);
					}

					// Get article with author and tags
					const articleWithData = await db.query.articles.findFirst({
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

					if (!articleWithData) {
						throw new NotFoundError("article");
					}

					return toResponse(
						{
							...articleWithData,
							tags: articleWithData.tags,
						},
						jwtPayload.uid,
					);
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
					auth: { jwtPayload },
				}) => {
					// Check article exists and user owns it
					const existingArticle = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
					});

					if (!existingArticle) {
						throw new NotFoundError("article");
					}

					if (existingArticle.authorId !== jwtPayload.uid) {
						throw new RealWorldError(StatusCodes.FORBIDDEN, {
							article: ["you can only update your own articles"],
						});
					}

					// Generate new slug if title changed
					let newSlug = existingArticle.slug;
					if (article.title && article.title !== existingArticle.title) {
						newSlug = slugify(article.title);
					}

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
							.delete(articleTags)
							.where(eq(articleTags.articleId, existingArticle.id));

						// Add new tags
						if (article.tagList.length > 0) {
							const tagPromises = article.tagList.map(async (tagName) => {
								const [existingTag] = await db
									.insert(tags)
									.values({ name: tagName })
									.onConflictDoNothing()
									.returning();

								if (existingTag) {
									return existingTag;
								}

								const [newTag] = await db
									.insert(tags)
									.values({ name: tagName })
									.returning();
								if (!newTag) {
									console.error(
										"Unexpected error: Could not create tag",
										tagName,
									);
								}
								return newTag;
							});

							const createdTags = sift(await Promise.all(tagPromises));

							await db.insert(articleTags).values(
								createdTags.map((tag) => ({
									articleId: existingArticle.id,
									tagId: tag.id,
								})),
							);
						}
					}

					// Get updated article with author and tags
					const articleWithData = await db.query.articles.findFirst({
						where: eq(articles.id, updatedArticle.id),
						with: {
							author: true,
							tags: {
								with: {
									tag: true,
								},
							},
						},
					});

					if (!articleWithData) {
						throw new NotFoundError("article");
					}

					return toResponse(articleWithData, jwtPayload.uid);
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
				async ({ params: { slug }, auth: { jwtPayload } }) => {
					// Check article exists and user owns it
					const existingArticle = await db.query.articles.findFirst({
						where: eq(articles.slug, slug),
					});

					if (!existingArticle) {
						throw new NotFoundError("article");
					}

					if (existingArticle.authorId !== jwtPayload.uid) {
						throw new RealWorldError(StatusCodes.FORBIDDEN, {
							article: ["you can only delete your own articles"],
						});
					}

					// Delete article (cascade will handle related records)
					await db.delete(articles).where(eq(articles.id, existingArticle.id));

					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					detail: {
						summary: "Delete Article",
					},
				},
			),
	);
