import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import type { users } from "@/users/users.schema";
import { and, count, eq, inArray } from "drizzle-orm";
import { type articles, favorites, type tags } from "../articles.schema";

type ArticleWithAuthor = typeof articles.$inferSelect & {
	author: typeof users.$inferSelect;
};

type ArticleWithTags = typeof articles.$inferSelect & {
	tags: Array<typeof tags.$inferSelect>;
};

type ArticleWithAuthorAndTags = ArticleWithAuthor & {
	tags: Array<typeof tags.$inferSelect>;
};

export async function toArticleResponse(
	article: ArticleWithAuthorAndTags,
	currentUserId?: string,
): Promise<{
	article: {
		slug: string;
		title: string;
		description: string;
		body: string;
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
}> {
	const [favoritesCount] = await db
		.select({ count: count() })
		.from(favorites)
		.where(eq(favorites.articleId, article.id));

	let favorited = false;
	if (currentUserId) {
		const [favorite] = await db
			.select()
			.from(favorites)
			.where(
				and(
					eq(favorites.articleId, article.id),
					eq(favorites.userId, currentUserId),
				),
			);
		favorited = Boolean(favorite);
	}

	let following = false;
	if (currentUserId && currentUserId !== article.author.id) {
		const [follow] = await db
			.select()
			.from(follows)
			.where(
				and(
					eq(follows.followerId, currentUserId),
					eq(follows.followingId, article.author.id),
				),
			);
		following = Boolean(follow);
	}

	return {
		article: {
			slug: article.slug,
			title: article.title,
			description: article.description,
			body: article.body,
			tagList: article.tags.map((tag) => tag.name),
			createdAt: article.createdAt.toISOString(),
			updatedAt: article.updatedAt.toISOString(),
			favorited,
			favoritesCount: Number(favoritesCount?.count || 0),
			author: {
				username: article.author.username,
				bio: article.author.bio,
				image: article.author.image,
				following,
			},
		},
	};
}

export async function toArticlesResponse(
	articlesWithData: Array<ArticleWithAuthorAndTags>,
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

export function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.trim();
}
