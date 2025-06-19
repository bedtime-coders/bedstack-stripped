import { db } from "@/core/db";
import { follows } from "@/profiles/profiles.schema";
import type { users } from "@/users/users.schema";
import { type InferSelectModel, and, eq } from "drizzle-orm";
import type { comments } from "../comments.schema";

/**
 * Map a comment to a response
 * @param comment The comment to map
 * @param currentUserId The current user's ID. If provided, the comment will be mapped to the current user's perspective.
 * @returns The mapped comment
 */
export async function toCommentResponse(
	comment: InferSelectModel<typeof comments> & {
		author: InferSelectModel<typeof users>;
	},
	currentUserId?: string,
): Promise<{
	comment: {
		id: string;
		createdAt: string;
		updatedAt: string;
		body: string;
		author: {
			username: string;
			bio: string | null;
			image: string | null;
			following: boolean;
		};
	};
}> {
	let following = false;
	if (currentUserId && currentUserId !== comment.author.id) {
		try {
			const [follow] = await db
				.select()
				.from(follows)
				.where(
					and(
						eq(follows.followerId, currentUserId),
						eq(follows.followingId, comment.author.id),
					),
				);
			following = Boolean(follow);
		} catch (error) {
			console.error("Error checking follow relationship:", error);
			// Set safe default value to prevent operation failure
			following = false;
		}
	}

	return {
		comment: {
			id: comment.id,
			createdAt: comment.createdAt.toISOString(),
			updatedAt: comment.updatedAt.toISOString(),
			body: comment.body,
			author: {
				username: comment.author.username,
				bio: comment.author.bio,
				image: comment.author.image,
				following,
			},
		},
	};
}

/**
 * Map an array of comments to a response
 * @param commentsWithAuthors The comments to map
 * @param currentUserId The current user's ID. If provided, the comments will be mapped to the current user's perspective.
 * @returns The mapped comments
 */
export async function toCommentsResponse(
	commentsWithAuthors: Array<
		InferSelectModel<typeof comments> & {
			author: InferSelectModel<typeof users>;
		}
	>,
	currentUserId?: string,
): Promise<{
	comments: Array<{
		id: string;
		createdAt: string;
		updatedAt: string;
		body: string;
		author: {
			username: string;
			bio: string | null;
			image: string | null;
			following: boolean;
		};
	}>;
}> {
	const comments = await Promise.all(
		commentsWithAuthors.map(async (comment) => {
			const response = await toCommentResponse(comment, currentUserId);
			return response.comment;
		}),
	);

	return {
		comments,
	};
}
