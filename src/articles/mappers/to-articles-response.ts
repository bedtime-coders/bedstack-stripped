import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import type { users } from "@/users/users.schema";
import { type InferSelectModel, and, count, eq, inArray } from "drizzle-orm";
import { type articles, favorites, type tags } from "../articles.schema";

/**
 * Map an array of articles to a response
 * @param articlesWithData The articles to map
 * @param currentUserId The current user's ID. If provided, the articles will be mapped to the current user's perspective.
 * @returns The mapped articles
 */
export async function toArticlesResponse(
	articlesWithData: Array<
		InferSelectModel<typeof articles> & {
			author: InferSelectModel<typeof users>;
			tags: Array<InferSelectModel<typeof tags>>;
		}
	>,
	currentUserId?: string,
): Promise<{
	articles: Array<{
		article: {
			slug: string;
			title: string;
			description: string;
			tagList: string[];
			createdAt: string;
			updatedAt: string;
			favorited: boolean;
			favoritesCount: number;
			author: {
				username: string;
				bio: string | null;
				image: string | null;
				following: boolean;
			};
		};
	}>;
	articlesCount: number;
}> {
	const articleIds = articlesWithData.map((article) => article.id);

	// Get favorites counts for all articles
	const favoritesCounts = await db
		.select({
			articleId: favorites.articleId,
			count: count(),
		})
		.from(favorites)
		.where(inArray(favorites.articleId, articleIds))
		.groupBy(favorites.articleId);

	// Get user favorites if authenticated
	let userFavorites: Array<{ articleId: string }> = [];
	if (currentUserId) {
		userFavorites = await db
			.select({ articleId: favorites.articleId })
			.from(favorites)
			.where(
				and(
					eq(favorites.userId, currentUserId),
					inArray(favorites.articleId, articleIds),
				),
			);
	}

	// Get following status for all authors
	let followingStatus: Array<{ followingId: string }> = [];
	if (currentUserId) {
		const authorIds = articlesWithData.map((article) => article.author.id);
		followingStatus = await db
			.select({ followingId: follows.followingId })
			.from(follows)
			.where(
				and(
					eq(follows.followerId, currentUserId),
					inArray(follows.followingId, authorIds),
				),
			);
	}

	const articles = await Promise.all(
		articlesWithData.map(async (article) => {
			const favoritesCount =
				favoritesCounts.find((fc) => fc.articleId === article.id)?.count || 0;

			const favorited = userFavorites.some(
				(fav) => fav.articleId === article.id,
			);

			const following = followingStatus.some(
				(follow) => follow.followingId === article.author.id,
			);

			return {
				article: {
					slug: article.slug,
					title: article.title,
					description: article.description,
					tagList: article.tags.map((tag) => tag.name),
					createdAt: article.createdAt.toISOString(),
					updatedAt: article.updatedAt.toISOString(),
					favorited,
					favoritesCount: Number(favoritesCount),
					author: {
						username: article.author.username,
						bio: article.author.bio,
						image: article.author.image,
						following,
					},
				},
			};
		}),
	);

	return {
		articles,
		articlesCount: articles.length,
	};
}
