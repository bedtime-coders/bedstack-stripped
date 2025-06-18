import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import { RealWorldError, assertNoConflicts } from "@/shared/errors";
import { auth } from "@/shared/plugins";
import { users } from "@/users/users.schema";
import { desc, eq, inArray } from "drizzle-orm";
import { Elysia, NotFoundError } from "elysia";
import { StatusCodes } from "http-status-codes";
import { sift } from "radashi";
import { articlesModel } from "./articles.model";
import { articleTags, articles, favorites, tags } from "./articles.schema";
import { generateSlug, toArticleResponse, toArticlesResponse } from "./mappers";

export const articlesPlugin = new Elysia()
	.use(auth)
	.use(articlesModel)
	.group("/articles", (app) =>
		app
			.get(
				"/",
				async ({ query, auth: { jwtPayload } }) => {
					const {
						tag,
						author: authorUsername,
						favorited: favoritedByUsername,
						limit = 20,
						offset = 0,
					} = query;

					// Get articles with authors using relational queries
					const articlesWithAuthors = await db.query.articles.findMany({
						with: {
							author: true,
							tags: {
								with: {
									tag: true,
								},
							},
						},
						orderBy: (articles, { desc }) => [desc(articles.createdAt)],
						limit,
						offset,
					});

					// Apply filters after fetching data
					let filteredArticles = articlesWithAuthors;

					if (tag) {
						filteredArticles = filteredArticles.filter((article) =>
							article.tags.some((articleTag) => articleTag.tag.name === tag),
						);
					}

					if (authorUsername) {
						filteredArticles = filteredArticles.filter(
							(article) => article.author.username === authorUsername,
						);
					}

					if (favoritedByUsername) {
						const favoritedUser = await db.query.users.findFirst({
							where: eq(users.username, favoritedByUsername),
						});
						if (!favoritedUser) {
							throw new NotFoundError("user");
						}

						const favoritedArticleIds = await db
							.select({ articleId: favorites.articleId })
							.from(favorites)
							.where(eq(favorites.userId, favoritedUser.id));

						const favoritedIds = favoritedArticleIds.map((f) => f.articleId);
						filteredArticles = filteredArticles.filter((article) =>
							favoritedIds.includes(article.id),
						);
					}

					// Get tags for all articles (already included in the query above)
					// No need for separate tag query since we have the data

					// Transform the data to match the expected format
					const articlesWithData = filteredArticles.map((article) => ({
						...article,
						tags: article.tags.map((articleTag) => articleTag.tag),
					}));

					return toArticlesResponse(articlesWithData, jwtPayload?.uid);
				},
				{
					detail: {
						summary: "List Articles",
						description:
							"Returns most recent articles globally by default, provide tag, author or favorited query parameter to filter results",
					},
					query: "ArticleQuery",
					response: "ArticlesResponse",
				},
			)
			.get(
				"/feed",
				async ({ query, auth: { jwtPayload } }) => {
					if (!jwtPayload) {
						throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
							token: ["is required"],
						});
					}

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
						tags: article.tags.map((articleTag) => articleTag.tag),
					}));

					return toArticlesResponse(articlesWithData, jwtPayload.uid);
				},
				{
					detail: {
						summary: "Feed Articles",
						description:
							"Can also take limit and offset query parameters like List Articles. Authentication required, will return multiple articles created by followed users, ordered by most recent first.",
						security: [{ tokenAuth: [] }],
					},
					query: "FeedQuery",
					response: "ArticlesResponse",
					auth: true,
				},
			)
			.post(
				"/",
				async ({ body: { article }, auth: { jwtPayload } }) => {
					if (!jwtPayload) {
						throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
							token: ["is required"],
						});
					}

					// Generate unique slug
					let slug = generateSlug(article.title);
					let counter = 1;
					while (true) {
						const existing = await db.query.articles.findFirst({
							where: eq(articles.slug, slug),
						});
						if (!existing) break;
						slug = `${generateSlug(article.title)}-${counter}`;
						counter++;
					}

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

					return toArticleResponse(
						{
							...articleWithData,
							tags: articleWithData.tags.map((at) => at.tag),
						},
						jwtPayload.uid,
					);
				},
				{
					detail: {
						summary: "Create Article",
						description: "Authentication required, will return an Article",
						security: [{ tokenAuth: [] }],
					},
					body: "CreateArticle",
					response: "Article",
					auth: true,
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

					return toArticleResponse(
						{
							...articleWithData,
							tags: articleWithData.tags.map((at) => at.tag),
						},
						jwtPayload?.uid,
					);
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
			.put(
				"/:slug",
				async ({
					params: { slug },
					body: { article },
					auth: { jwtPayload },
				}) => {
					if (!jwtPayload) {
						throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
							token: ["is required"],
						});
					}

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
						newSlug = generateSlug(article.title);
						let counter = 1;
						while (true) {
							const existing = await db.query.articles.findFirst({
								where: eq(articles.slug, newSlug),
							});
							if (!existing || existing.id === existingArticle.id) break;
							newSlug = `${generateSlug(article.title)}-${counter}`;
							counter++;
						}
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

					return toArticleResponse(
						{
							...articleWithData,
							tags: articleWithData.tags.map((at) => at.tag),
						},
						jwtPayload.uid,
					);
				},
				{
					detail: {
						summary: "Update Article",
						description:
							"Authentication required, returns the updated Article. The slug also gets updated when the title is changed.",
						security: [{ tokenAuth: [] }],
					},
					body: "UpdateArticle",
					response: "Article",
					auth: true,
				},
			)
			.delete(
				"/:slug",
				async ({ params: { slug }, auth: { jwtPayload } }) => {
					if (!jwtPayload) {
						throw new RealWorldError(StatusCodes.UNAUTHORIZED, {
							token: ["is required"],
						});
					}

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
						description: "Authentication required",
						security: [{ tokenAuth: [] }],
					},
					auth: true,
				},
			),
	);
