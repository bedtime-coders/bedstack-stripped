import { defineRelations } from "drizzle-orm";
import { articles, favorites } from "@/articles/articles.schema";
import { comments } from "@/comments/comments.schema";
import { follows } from "@/profiles/profiles.schema";
import { articlesToTags, tags } from "@/tags/tags.schema";
import { users } from "@/users/users.schema";

const schema = {
	users,
	follows,
	articles,
	tags,
	comments,
	articlesToTags,
	favorites,
};

export const relations = defineRelations(schema, (r) => ({
	// Articles relations
	articles: {
		author: r.one.users({
			from: r.articles.authorId,
			to: r.users.id,
			optional: false,
		}),
		tags: r.many.tags({
			from: r.articles.id.through(r.articlesToTags.articleId),
			to: r.tags.id.through(r.articlesToTags.tagId),
		}),
		comments: r.many.comments({
			from: r.articles.id,
			to: r.comments.articleId,
		}),
		favorites: r.many.favorites({
			from: r.articles.id,
			to: r.favorites.articleId,
		}),
	},

	// Users relations
	users: {
		// One-to-many: users can have many articles, comments, favorites
		articles: r.many.articles({
			from: r.users.id,
			to: r.articles.authorId,
		}),
		comments: r.many.comments({
			from: r.users.id,
			to: r.comments.authorId,
		}),
		favorites: r.many.favorites({
			from: r.users.id,
			to: r.favorites.userId,
		}),

		// Many-to-many: users can follow many users and be followed by many users
		following: r.many.users({
			from: r.users.id.through(r.follows.followerId),
			to: r.users.id.through(r.follows.followedId),
		}),
		followers: r.many.users({
			from: r.users.id.through(r.follows.followedId),
			to: r.users.id.through(r.follows.followerId),
		}),
	},

	// Comments relations
	comments: {
		author: r.one.users({
			from: r.comments.authorId,
			to: r.users.id,
			optional: false,
		}),
		article: r.one.articles({
			from: r.comments.articleId,
			to: r.articles.id,
		}),
	},

	// Tags relations
	tags: {
		articles: r.many.articles({
			from: r.tags.id.through(r.articlesToTags.tagId),
			to: r.articles.id.through(r.articlesToTags.articleId),
		}),
	},

	// Junction table relations (if needed for direct access)
	follows: {
		follower: r.one.users({
			from: r.follows.followerId,
			to: r.users.id,
		}),
		followed: r.one.users({
			from: r.follows.followedId,
			to: r.users.id,
		}),
	},

	articlesToTags: {
		article: r.one.articles({
			from: r.articlesToTags.articleId,
			to: r.articles.id,
		}),
		tag: r.one.tags({
			from: r.articlesToTags.tagId,
			to: r.tags.id,
		}),
	},

	favorites: {
		user: r.one.users({
			from: r.favorites.userId,
			to: r.users.id,
		}),
		article: r.one.articles({
			from: r.favorites.articleId,
			to: r.articles.id,
		}),
	},
}));
