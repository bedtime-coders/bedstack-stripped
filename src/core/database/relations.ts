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

export const relations = defineRelations(
	schema,
	({
		one,
		many,
		articles,
		users,
		comments,
		articlesToTags,
		favorites,
		tags,
	}) => ({
		articles: {
			user: one.users({
				from: articles.authorId,
				to: users.id,
				alias: "articles_authorId_users_id",
			}),
			usersViaComments: many.users({
				from: articles.id.through(comments.articleId),
				to: users.id.through(comments.authorId),
				alias: "articles_id_users_id_via_comments",
			}),
			tags: many.tags({
				from: articles.id.through(articlesToTags.articleId),
				to: tags.id.through(articlesToTags.tagId),
			}),
			usersViaFavorites: many.users({
				from: articles.id.through(favorites.articleId),
				to: users.id.through(favorites.userId),
				alias: "articles_id_users_id_via_favorites",
			}),
		},
		users: {
			articlesAuthorId: many.articles({
				alias: "articles_authorId_users_id",
			}),
			articlesViaComments: many.articles({
				alias: "articles_id_users_id_via_comments",
			}),
			articlesViaFavorites: many.articles({
				alias: "articles_id_users_id_via_favorites",
			}),
		},
		tags: {
			articles: many.articles(),
		},
	}),
);
