import type { ArticlesResponse, EnrichedArticle } from "../interfaces";

/**
 * Map an array of articles to a response
 * @param enrichedArticles The articles to map, each article is enriched with the user's favorites, follow status, and favorites count
 * @param extras The extras to map, see {@link Extras}
 * @returns The mapped articles
 */
export function toArticlesResponse(
	enrichedArticles: EnrichedArticle[],
	{ currentUserId }: { currentUserId?: string | null } = {},
): ArticlesResponse {
	const myArticles = enrichedArticles.map((article) => {
		const myFavorites =
			article.favorites?.filter((f) => f.userId === currentUserId) ?? [];
		const myFollows =
			article.author.followers?.filter((f) => f.followerId === currentUserId) ??
			[];
		const favoritesCount = article.favorites?.length ?? 0;
		const isFavorited = myFavorites.length > 0;
		const isFollowing = myFollows.length > 0;
		return {
			slug: article.slug,
			title: article.title,
			description: article.description,
			tagList: article.tags
				.map((t) => t.tag.name)
				.sort((a, b) => a.localeCompare(b)),
			createdAt: article.createdAt.toISOString(),
			updatedAt: article.updatedAt.toISOString(),
			favorited: isFavorited,
			favoritesCount,
			author: {
				username: article.author.username,
				bio: article.author.bio,
				image: article.author.image,
				following: isFollowing,
			},
		};
	});

	return {
		articlesCount: enrichedArticles.length,
		articles: myArticles,
	};
}
