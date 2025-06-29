import type { InferSelectModel } from "drizzle-orm";
import type { tags } from "@/tags/tags.schema";
import type { users } from "@/users/users.schema";
import type { articles, favorites } from "../articles.schema";

/**
 * An article enriched with optional relations
 */
export type EnrichedArticle = InferSelectModel<typeof articles> & {
	author: InferSelectModel<typeof users> & {
		followers?: Array<InferSelectModel<typeof users>>;
	};
	tags: Array<InferSelectModel<typeof tags>>;
	favorites?: Array<InferSelectModel<typeof favorites>>;
};

/**
 * A personalized enriched article with followers and favorites
 */
export type PersonalizedEnrichedArticle = EnrichedArticle & {
	author: InferSelectModel<typeof users> & {
		followers?: Array<InferSelectModel<typeof users>>;
	};
	favorites: Array<InferSelectModel<typeof favorites>>;
};
