import type { EnrichedArticle } from "../interfaces";

type ToResponseParams = {
	/**
	 * The ID of the current user
	 * If provided, the article will be enriched with the current user's information, including article favorites and author following
	 */
	currentUserId?: string | null;
};

/**
 * Map an article to a response
 * @param article The article to map
 * @param params The parameters to map the article
 * @returns The mapped article
 */
export function toResponse(
	article: EnrichedArticle,
	{ currentUserId }: ToResponseParams = {},
): {
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
} {
	const favorited = article.favorites?.some((f) => f.userId === currentUserId);
	const favoritesCount = article.favorites?.length ?? 0;
	const following = article.author.followers?.some(
		(f) => f.id === currentUserId,
	);

	return {
		article: {
			slug: article.slug,
			title: article.title,
			description: article.description,
			body: article.body,
			tagList: article.tags
				.map((t) => t.name)
				.sort((a, b) => a.localeCompare(b)),
			createdAt: article.createdAt.toISOString(),
			updatedAt: article.updatedAt.toISOString(),
			favorited: favorited ?? false,
			favoritesCount: favoritesCount ?? 0,
			author: {
				username: article.author.username,
				bio: article.author.bio,
				image: article.author.image,
				following: following ?? false,
			},
		},
	};
}
