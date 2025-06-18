import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import type { users } from "@/users/users.schema";
import { type InferSelectModel, and, count, eq } from "drizzle-orm";
import { type articles, favorites, type tags } from "../articles.schema";

export async function toResponse(
	article: InferSelectModel<typeof articles> & {
		author: InferSelectModel<typeof users>;
		tags: Array<InferSelectModel<typeof tags>>;
	},
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
