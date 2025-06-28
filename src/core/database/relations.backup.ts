import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	articles: {
		user: r.one.users({
			from: r.articles.authorId,
			to: r.users.id,
			alias: "articles_authorId_users_id",
		}),
		usersViaComments: r.many.users({
			from: r.articles.id.through(r.comments.articleId),
			to: r.users.id.through(r.comments.authorId),
			alias: "articles_id_users_id_via_comments",
		}),
		tags: r.many.tags({
			from: r.articles.id.through(r.articlesToTags.articleId),
			to: r.tags.id.through(r.articlesToTags.tagId),
		}),
		usersViaFavorites: r.many.users({
			from: r.articles.id.through(r.favorites.articleId),
			to: r.users.id.through(r.favorites.userId),
			alias: "articles_id_users_id_via_favorites",
		}),
	},
	users: {
		articlesAuthorId: r.many.articles({
			alias: "articles_authorId_users_id",
		}),
		articlesViaComments: r.many.articles({
			alias: "articles_id_users_id_via_comments",
		}),
		articlesViaFavorites: r.many.articles({
			alias: "articles_id_users_id_via_favorites",
		}),
	},
	tags: {
		articles: r.many.articles(),
	},
}));
