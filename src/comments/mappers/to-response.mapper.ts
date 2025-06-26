import type { InferSelectModel } from "drizzle-orm";
import type { follows } from "@/profiles/profiles.schema";
import type { users } from "@/users/users.schema";
import type { comments } from "../comments.schema";

/**
 * Map a comment to a response
 * @param enrichedComment The comment to map, enriched with the author and their followers
 * @param currentUserId The current user's ID. If provided, the comment will be mapped to the current user's perspective.
 * @param followingStatus Optional pre-fetched following status for the comment author
 * @returns The mapped comment
 */
export function toCommentResponse(
	enrichedComment: InferSelectModel<typeof comments> & {
		author: InferSelectModel<typeof users> & {
			followers: InferSelectModel<typeof follows>[];
		};
	},
	{ currentUserId }: { currentUserId?: string | null } = {},
): {
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
} {
	return {
		comment: {
			id: enrichedComment.id,
			createdAt: enrichedComment.createdAt.toISOString(),
			updatedAt: enrichedComment.updatedAt.toISOString(),
			body: enrichedComment.body,
			author: {
				username: enrichedComment.author.username,
				bio: enrichedComment.author.bio,
				image: enrichedComment.author.image,
				following: Boolean(
					currentUserId &&
						enrichedComment.author.followers.some(
							(f) => f.followerId === currentUserId,
						),
				),
			},
		},
	};
}

/**
 * Map an array of comments to a response
 * @param enrichedComments The comments to map, enriched with the author and their followers
 * @param currentUserId The current user's ID. If provided, the comments will be mapped to the current user's perspective.
 * @returns The mapped comments
 */
export function toCommentsResponse(
	enrichedComments: Array<
		InferSelectModel<typeof comments> & {
			author: InferSelectModel<typeof users> & {
				followers: InferSelectModel<typeof follows>[];
			};
		}
	>,
	{ currentUserId }: { currentUserId?: string | null } = {},
): {
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
} {
	const comments = enrichedComments.map(
		(comment) => toCommentResponse(comment, { currentUserId }).comment,
	);
	return {
		comments,
	};
}
